#!/usr/bin/env python3
"""自动将本地音乐文件同步至站点曲库并部署上线。

与相册（assets/cos/，随仓库走）不同，音频文件体积大，刻意不进 git：
音频只上传到服务器 /var/www/luohua/music/（Nginx 以 /audio/ 读盘），
仓库里只保留播放清单 main/src/data/musicTracks.js（元数据 + URL）。

默认源目录：脚本顶部的 DEFAULT_SOURCE，可用 --source 覆盖。
工作流程：
1. 扫描源目录中的音频（.mp3/.m4a/.flac/.ogg/.wav），按内容 sha1 前 16 位命名；
   加 --transcode 则把无损文件转成 AAC 192k/48kHz 再入库（id 仍按原始文件算，
   所以调码率重转不会产生新 id）；
2. mutagen 读标题/歌手/专辑/时长，Pillow 提取内嵌封面（≤500px JPEG）；
3. 仅新文件经 tar over ssh 增量上传（只增不删，不经过 deploy-azure.sh 的
   清空式 upload_dir，主站部署永远不会碰到这个目录）；加 --prune 则在写完
   清单后删掉服务器上没有被清单引用的文件（换格式留下的旧文件）；
4. 重写 musicTracks.js（PRESET 置顶曲 + 历史条目合并 + 新曲按时间倒序）；
5. 在 master 分支上提交清单并推送，再跑 deploy-azure.sh main 上线前端。

注意：换服务器/重装时 /var/www/luohua/music/ 必须单独搬走——它是生产环境
唯一无法从 checkout 重建的数据（详见 docs/AZURE_DEPLOYMENT_HANDOFF.md）。
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import re
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

# 防止 Windows 终端在输出 Unicode 符号时抛出 GBK 编码错误
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

ROOT = Path(__file__).resolve().parent.parent

try:
    from mutagen import File as MutagenFile
except ImportError:
    print("错误: 缺少 mutagen，请先执行 pip install mutagen", file=sys.stderr)
    raise SystemExit(1)

AUDIO_EXTS = {".mp3", ".m4a", ".flac", ".ogg", ".wav"}
# 上传暂存区：想上线的音频丢进这个目录（可带 艺术家/专辑 子目录，会递归扫）。
# 和个人曲库分开，避免"整个曲库都会被传上去"的误操作。
DEFAULT_SOURCE = Path(r"F:\blogload\music")
COVER_MAX_PX = 500

# --transcode 的目标格式。选 AAC 而不是同码率下音质更好的 Opus，是因为播放器
# 是单 src 的 <audio>，做不了多格式回退，而 m4a 连老 Safari/iOS 都认。
#
# 96kHz/24bit 的母带在网页播放里是纯浪费：浏览器最终也只送 48kHz 进声卡。
# 真正的痛点是首字节延迟——2700 kbps 意味着"缓冲 10 秒音乐得先下 3.4 MB"，
# 192 kbps 下同样 10 秒只要 240 KB。
TRANSCODE_EXT = ".m4a"
TRANSCODE_BITRATE = "192k"
TRANSCODE_SAMPLE_RATE = "48000"
LOSSLESS_EXTS = {".flac", ".wav"}
# 已经是有损的一律原样收录，直到码率高得不像有损为止（400k 以上基本就是
# ALAC 这类装在 m4a 里的无损）。320k 的 mp3 转 192k AAC 是最亏的一笔买卖：
# 只省下 40% 体积——起播延迟本来就没问题——却实打实赔掉一代音质。
PASSTHROUGH_MAX_BPS = 400_000
FFMPEG_FALLBACKS = [
    Path(
        r"F:\游戏制作\unity3D课"
        r"\ffmpeg-20200311-36aaee2-win64-static\bin\ffmpeg.exe"
    ),
]

# 与 deploy/deploy-azure.sh 保持同一套 SSH 约定：密钥在仓库外，known_hosts
# 放在密钥旁边（Git Bash 处理不了含非 ASCII 的 home 目录）。
DEPLOY_HOST = "65.52.160.147"
DEPLOY_USER = "azureuser"
DEPLOY_KEY = Path("E:/TOOLS/blog-server-key.pem")
DEPLOY_KNOWN_HOSTS = DEPLOY_KEY.parent / "known_hosts"

SERVER_MUSIC_DIR = "/var/www/luohua/music"
MANIFEST_PATH = ROOT / "main" / "src" / "data" / "musicTracks.js"
# 置顶曲目：无条件排在清单最前，且不受源目录扫描影响。
# 目前是空的——曲库自建起来之后，仓库自带的那首循环 BGM 就没有理由再占据
# 歌单第一行了。机制留着，以后想置顶某首歌直接往这里加即可。
PRESET_TRACKS: list[dict] = []

MANIFEST_HEADER = """// 播放清单。数组顺序即页面展示顺序，新歌在前面；tools/sync_music.py 重新生成时
// 会整体覆盖本文件，所以想置顶的曲目请维护在那个脚本的 PRESET_TRACKS 常量里。
//
// 每条的字段：
//   id        唯一标识（音频内容 sha1 前 16 位），播放器状态恢复靠它定位
//   title     歌名；无标签文件由同步脚本用文件名兜底
//   artist    歌手
//   album     可选，专辑名
//   src       音频地址；自托管曲库是 /audio/<id>.<ext>
//             （手写的仓库内曲目走 /cos/ 前缀，中文路径需保持 URL 编码原样）
//   cover     可选，封面图地址；缺省时 UI 用默认渐变封面
//   duration  时长（秒），同步脚本用 mutagen 现测；0 表示未知，播放器加载后自动取真值
//   addedAt   ISO 时间，仅用于展示与排序
export const musicTracks = [
"""

MANIFEST_FOOTER = "];\n\nexport const getMusicTrack = (id) =>\n  musicTracks.find((track) => track.id === id) || null;\n"


def find_bash() -> str:
    git_bash = Path(r"C:\Program Files\Git\bin\bash.exe")
    if git_bash.is_file():
        return str(git_bash)
    return "bash"


def ssh_argv() -> list[str]:
    return [
        "ssh",
        "-o", "BatchMode=yes",
        "-o", "ConnectTimeout=20",
        "-o", "StrictHostKeyChecking=accept-new",
        "-o", f"UserKnownHostsFile={DEPLOY_KNOWN_HOSTS}",
        "-i", str(DEPLOY_KEY),
        f"{DEPLOY_USER}@{DEPLOY_HOST}",
    ]


def run_remote(command: str) -> str:
    result = subprocess.run(
        ssh_argv() + [command], cwd=ROOT, capture_output=True, text=True
    )
    if result.returncode != 0:
        raise RuntimeError(f"远程命令失败: {command}\n{result.stderr.strip()}")
    return result.stdout


def run_cmd(cmd: list[str], cwd: Path | None = None) -> None:
    print(f"\n==> 执行命令: {' '.join(cmd)}")
    result = subprocess.run(cmd, cwd=cwd or ROOT, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"命令执行失败 (code {result.returncode}): {' '.join(cmd)}")


def find_ffmpeg(explicit: Path | None = None) -> str:
    """按 --ffmpeg > PATH > 已知安装位置 的顺序找 ffmpeg。"""
    if explicit:
        if not Path(explicit).is_file():
            raise RuntimeError(f"--ffmpeg 指定的文件不存在: {explicit}")
        return str(explicit)
    found = shutil.which("ffmpeg")
    if found:
        return found
    for candidate in FFMPEG_FALLBACKS:
        if candidate.is_file():
            return str(candidate)
    raise RuntimeError(
        "找不到 ffmpeg。装一个（winget install Gyan.FFmpeg）或用 --ffmpeg 指定路径。"
    )


def should_transcode(path: Path) -> bool:
    """无损一律转；已经有损的只在码率高得离谱时才重编，避免二次损失。"""
    if path.suffix.lower() in LOSSLESS_EXTS:
        return True
    audio = MutagenFile(str(path))
    bitrate = getattr(audio.info, "bitrate", 0) if audio is not None and audio.info else 0
    return bitrate > PASSTHROUGH_MAX_BPS


def transcode(ffmpeg: str, source: Path, dest: Path) -> None:
    """转成 AAC。

    -vn 丢掉内嵌封面：封面由 mutagen 从原始文件单独提取，再塞进 m4a 只会让
    每个文件白胖 1 MB。+faststart 把 moov atom 挪到文件头，否则浏览器要先取
    文件尾部的索引才能起播，白白多一个来回。
    """
    result = subprocess.run(
        [
            ffmpeg, "-hide_banner", "-loglevel", "error", "-y",
            "-i", str(source),
            "-vn",
            "-c:a", "aac",
            "-b:a", TRANSCODE_BITRATE,
            "-ar", TRANSCODE_SAMPLE_RATE,
            "-ac", "2",
            "-movflags", "+faststart",
            str(dest),
        ],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0 or not dest.is_file():
        raise RuntimeError(f"ffmpeg 转码失败: {source.name}\n{result.stderr.strip()}")


def content_id(path: Path) -> str:
    """曲目 id。**永远按源目录里的原始文件算，不能按转码产物算。**

    否则哪天调了码率重转，同一首歌会拿到全新 id：服务器上留一份孤儿文件、
    清单里多一条重复曲目、用户 localStorage 里"上次听到哪首"也一并失效。
    """
    digest = hashlib.sha1()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()[:16]


def first_id3(tags, frame: str) -> str | None:
    frames = tags.getall(frame)
    return str(frames[0]) if frames else None


def first_text(tags, *keys: str) -> str | None:
    for key in keys:
        # VorbisComment（flac/ogg）对不合法的键名直接抛 ValueError，
        # 而不是返回 None——拿 MP4 的 "©nam" 去问它就会炸。
        try:
            value = tags.get(key)
        except (ValueError, KeyError):
            continue
        if value:
            return str(value[0])
    return None


def read_tags(path: Path) -> tuple[str | None, str | None, str | None, bytes | None]:
    """返回 (title, artist, album, 内嵌封面字节)。覆盖 mp3/m4a/flac/ogg/wav。"""
    audio = MutagenFile(str(path))
    if audio is None or audio.tags is None:
        return None, None, None, None
    tags = audio.tags
    title = artist = album = None
    cover = None

    if hasattr(tags, "getall"):  # ID3（mp3、部分 wav）
        title, artist, album = (
            first_id3(tags, "TIT2"),
            first_id3(tags, "TPE1"),
            first_id3(tags, "TALB"),
        )
        pictures = tags.getall("APIC")
        if pictures:
            cover = pictures[0].data
    elif hasattr(audio, "pictures"):  # FLAC：封面挂在文件对象上，不在 tags 上
        title, artist, album = (
            first_text(tags, "title"),
            first_text(tags, "artist"),
            first_text(tags, "album"),
        )
        if audio.pictures:
            cover = audio.pictures[0].data
    elif hasattr(tags, "get"):  # MP4（m4a）/ VorbisComment（ogg）
        title, artist, album = (
            first_text(tags, "\xa9nam", "title"),
            first_text(tags, "\xa9ART", "artist"),
            first_text(tags, "\xa9alb", "album"),
        )
        covers = tags.get("covr") or []
        if covers:
            cover = bytes(covers[0])
    return title, artist, album, cover


def save_cover(raw: bytes, dest: Path) -> bool:
    try:
        from PIL import Image
    except ImportError:
        print("[WARN] 缺少 Pillow，无法提取内嵌封面（pip install Pillow）", file=sys.stderr)
        return False
    try:
        image = Image.open(io.BytesIO(raw))
        if image.mode != "RGB":
            image = image.convert("RGB")
        image.thumbnail((COVER_MAX_PX, COVER_MAX_PX))
        image.save(dest, "JPEG", quality=85)
        return True
    except Exception as error:
        print(f"[WARN] 封面提取失败（忽略，用默认渐变封面）: {error}", file=sys.stderr)
        return False


def preset_tracks() -> list[dict]:
    return [dict(entry) for entry in PRESET_TRACKS]


def parse_existing_tracks() -> list[dict]:
    """解析现行清单里的条目（脚本与手写条目都是一行一字段的规范格式）。"""
    if not MANIFEST_PATH.exists():
        return []
    text = MANIFEST_PATH.read_text(encoding="utf-8")
    tracks: list[dict] = []
    for block in re.findall(r"\{([^{}]*)\}", text):
        fields = dict(
            re.findall(
                r'(\w+):\s*("(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?|null|true|false)',
                block,
            )
        )
        if "id" not in fields or "src" not in fields:
            continue
        tracks.append(
            {
                "id": json.loads(fields["id"]),
                "title": json.loads(fields["title"]) if "title" in fields else "",
                "artist": json.loads(fields["artist"]) if "artist" in fields else "未知歌手",
                "album": json.loads(fields["album"]) if "album" in fields else "",
                "src": json.loads(fields["src"]),
                "cover": None if fields.get("cover") == "null" else json.loads(fields.get("cover", "null")),
                "duration": float(fields.get("duration", 0)),
                "addedAt": json.loads(fields["addedAt"]) if "addedAt" in fields else "",
            }
        )
    return tracks


def render_track(track: dict) -> str:
    lines = [
        "  {",
        f'    id: {json.dumps(track["id"], ensure_ascii=False)},',
        f'    title: {json.dumps(track["title"], ensure_ascii=False)},',
        f'    artist: {json.dumps(track["artist"], ensure_ascii=False)},',
        f'    album: {json.dumps(track["album"], ensure_ascii=False)},',
        f'    src: {json.dumps(track["src"], ensure_ascii=False)},',
        f'    cover: {json.dumps(track["cover"], ensure_ascii=False)},',
        f'    duration: {round(float(track["duration"]), 2)},',
        f'    addedAt: {json.dumps(track["addedAt"], ensure_ascii=False)},',
        "  },",
    ]
    return "\n".join(lines)


def render_manifest(tracks: list[dict]) -> str:
    # render_track 每块自带结尾逗号，这里只能用空行连接。再补一个逗号就会写出
    # "},,"——那在数组字面量里是一个空洞（undefined），不是格式问题而是数据错：
    # musicTracks 里会混进 undefined，Object.fromEntries 当场抛。清单只有一首时
    # join 根本不执行，所以这个 bug 一直藏到收录第二首才现形。
    body = "\n\n".join(render_track(track) for track in tracks)
    return MANIFEST_HEADER + body + "\n" + MANIFEST_FOOTER


def ingest_source(
    source_dir: Path,
    staging: Path,
    known_srcs: dict[str, str],
    ffmpeg: str | None = None,
    album_filter: str | None = None,
) -> list[dict]:
    """扫描源目录，把新曲目落成 {id}.{ext} 并提取封面，返回新条目列表。

    known_srcs 是 {id: 清单里的 src}，不是单纯的 id 集合：开了 --transcode
    之后，已入库但还是 flac 的老条目要能被认出来并重做，否则它会因为"id 已知"
    被永远跳过，一半曲库转了一半没转。
    """
    # 递归扫：正常的曲库都是 艺术家/专辑/曲目 三层，非递归的 iterdir 在这种
    # 目录上只会扫出 0 首。文件名不参与落盘（一律改成 {id}{ext}），所以不同
    # 专辑下的重名文件不会互相覆盖。
    files = sorted(
        (p for p in source_dir.rglob("*") if p.suffix.lower() in AUDIO_EXTS and p.is_file()),
        key=lambda p: p.stat().st_mtime,
    )
    new_tracks: list[dict] = []
    bytes_in = bytes_out = 0
    for path in files:
        # 先读标签再算哈希：--album 过滤掉的文件不必白读几十兆去做 sha1，
        # 一张专辑常常散在多个艺术家目录下，光靠 --source 圈不出来。
        title, artist, album, cover_raw = read_tags(path)
        if album_filter and album_filter.lower() not in (album or "").lower():
            continue

        tid = content_id(path)  # 认原始文件，与是否转码无关
        converting = bool(ffmpeg) and should_transcode(path)
        ext = TRANSCODE_EXT if converting else path.suffix.lower()

        previous = known_srcs.get(tid)
        if previous is not None and previous.endswith(ext):
            continue

        staged_audio = staging / f"{tid}{ext}"
        if converting:
            transcode(ffmpeg, path, staged_audio)
        else:
            shutil.copyfile(path, staged_audio)

        cover_name = None
        if cover_raw:
            staged_cover = staging / f"{tid}.cover.jpg"
            if save_cover(cover_raw, staged_cover):
                cover_name = f"/audio/{tid}.cover.jpg"

        added_at = datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc)
        new_tracks.append(
            {
                "id": tid,
                "title": (title or path.stem).strip() or tid,
                "artist": (artist or "未知歌手").strip(),
                "album": (album or "").strip(),
                "src": f"/audio/{tid}{ext}",
                "cover": cover_name,
                # 时长按原始文件读：转码后差几十毫秒，但列表显示的是"这首歌多长"
                "duration": round(_duration_seconds(path), 2),
                "addedAt": added_at.strftime("%Y-%m-%dT%H:%M:%SZ"),
            }
        )
        known_srcs[tid] = new_tracks[-1]["src"]

        before = path.stat().st_size
        after = staged_audio.stat().st_size
        bytes_in += before
        bytes_out += after
        note = ""
        if converting:
            note = f"  ({before / 1024**2:.0f} MB -> {after / 1024**2:.1f} MB)"
        elif ffmpeg:
            note = "  (原样收录，不重编)"
        print(
            f"  + {path.name} -> {tid}{ext}"
            f"  [{new_tracks[-1]['title']} / {new_tracks[-1]['artist']}]{note}"
        )

    if new_tracks:
        summary = f"\n  合计 {len(new_tracks)} 首，将上传 {bytes_out / 1024**2:.1f} MB"
        if ffmpeg and bytes_out < bytes_in:
            summary += f"（源文件 {bytes_in / 1024**2:.0f} MB，压到 1/{bytes_in / bytes_out:.1f}）"
        print(summary)
    return new_tracks


def _duration_seconds(path: Path) -> float:
    audio = MutagenFile(str(path))
    if audio is not None and audio.info:
        return float(audio.info.length)
    return 0.0


def remote_names() -> set[str]:
    return {
        line.strip()
        for line in run_remote(
            f"sudo ls -1 {SERVER_MUSIC_DIR} 2>/dev/null || true"
        ).splitlines()
        if line.strip()
    }


def prune_remote(tracks: list[dict], dry_run: bool = False) -> int:
    """删掉服务器上没有被清单引用的文件。

    上传是"只增不删"，所以换格式重转、删歌、改码率之后旧文件都会留在盘上。
    这是唯一会在生产上删东西的操作，所以：清单里一条 /audio/ 都没有时直接
    拒绝执行——那种情况下"没被引用"等于"全部"，一删就是整个曲库，而这个
    目录是从 git 重建不出来的。
    """
    keep: set[str] = set()
    for track in tracks:
        for url in (track.get("src"), track.get("cover")):
            if url and url.startswith("/audio/"):
                keep.add(url.rsplit("/", 1)[-1])

    if not keep:
        print(
            "[ERROR] 清单里没有任何 /audio/ 曲目，拒绝 prune"
            "（这会删光整个曲库，而它无法从仓库重建）。",
            file=sys.stderr,
        )
        return 0

    orphans = sorted(remote_names() - keep)
    if not orphans:
        print("服务器上没有多余文件，无需清理。")
        return 0

    listing = run_remote(
        "sudo du -b -c "
        + " ".join(f"'{SERVER_MUSIC_DIR}/{name}'" for name in orphans)
        + " 2>/dev/null | tail -1"
    ).strip()
    total = listing.split()[0] if listing else "0"
    print(f"==> {len(orphans)} 个文件没有被清单引用，合计 {int(total) / 1024**2:.1f} MB:")
    for name in orphans:
        print(f"    - {name}")

    if dry_run:
        print("[dry-run 模式] 未删除。")
        return 0

    run_remote(
        "sudo rm -f -- "
        + " ".join(f"'{SERVER_MUSIC_DIR}/{name}'" for name in orphans)
    )
    print(f"[OK] 已删除 {len(orphans)} 个孤儿文件")
    return len(orphans)


def upload_staged(staging: Path) -> int:
    """把 staging 里服务器上还没有的文件增量传上去（只增不删）。"""
    existing = set()
    try:
        existing = remote_names()
    except RuntimeError as error:
        print(f"[WARN] 读取服务器目录失败，将全量上传本次文件: {error}", file=sys.stderr)

    pending = sorted(p.name for p in staging.iterdir() if p.name not in existing)
    if not pending:
        print("服务器上已有全部文件，跳过上传。")
        return 0

    print(f"==> 上传 {len(pending)} 个文件到 {SERVER_MUSIC_DIR}")
    tar_process = subprocess.Popen(
        ["tar", "-C", str(staging), "-czf", "-", *pending],
        stdout=subprocess.PIPE,
    )
    ssh_process = subprocess.Popen(
        ssh_argv()
        + [
            f"sudo mkdir -p '{SERVER_MUSIC_DIR}' && "
            f"sudo tar -C '{SERVER_MUSIC_DIR}' -xzf - && "
            f"sudo chown -R www-data:www-data '{SERVER_MUSIC_DIR}' && "
            f"sudo chmod -R 775 '{SERVER_MUSIC_DIR}'"
        ],
        stdin=tar_process.stdout,
    )
    tar_process.stdout.close()
    if ssh_process.wait() != 0 or tar_process.wait() != 0:
        raise RuntimeError("音频上传失败（tar over ssh）")
    return len(pending)


def current_branch() -> str:
    result = subprocess.run(
        ["git", "rev-parse", "--abbrev-ref", "HEAD"],
        cwd=ROOT, capture_output=True, text=True,
    )
    return result.stdout.strip()


def sync_music(
    source_dir: Path,
    dry_run: bool = False,
    no_commit: bool = False,
    no_deploy: bool = False,
    allow_any_branch: bool = False,
    transcode_audio: bool = False,
    prune: bool = False,
    ffmpeg_path: Path | None = None,
    album_filter: str | None = None,
) -> int:
    print("=" * 50)
    print("   伊洛华站点 · 本地音乐库同步工具")
    print(f"   源目录: {source_dir}")
    print("=" * 50)

    if not source_dir.is_dir():
        print(f"错误: 找不到目录 {source_dir}", file=sys.stderr)
        return 1

    if album_filter:
        print(f"   只收录专辑名含「{album_filter}」的曲目")

    ffmpeg = None
    if transcode_audio:
        try:
            ffmpeg = find_ffmpeg(ffmpeg_path)
        except RuntimeError as error:
            print(f"错误: {error}", file=sys.stderr)
            return 1
        print(f"   转码: AAC {TRANSCODE_BITRATE} / {TRANSCODE_SAMPLE_RATE} Hz")
        print(f"   ffmpeg: {ffmpeg}")

    existing = parse_existing_tracks()
    preset = preset_tracks()
    known_srcs = {track["id"]: track["src"] for track in existing + preset}

    print(f"\n[1/4] 扫描新曲目（清单已有 {len(known_srcs)} 首）...")
    with tempfile.TemporaryDirectory(prefix="music-sync-") as tmp:
        staging = Path(tmp)
        new_tracks = ingest_source(
            source_dir, staging, known_srcs, ffmpeg, album_filter
        )
        new_count = len(new_tracks)

        if dry_run:
            print(f"\n[dry-run 模式] 预计可收录 {new_count} 首曲目，未上传也未改清单。")
            if prune:
                print("\n[dry-run] 若执行 --prune 会清理：")
                prune_remote(existing, dry_run=True)
            return 0

        if new_count == 0:
            print("\n[OK] 未检测到新曲目，清单已是最新。")
            if prune:
                print("\n[2/4] 清理服务器上的孤儿文件...")
                prune_remote(existing)
            return 0

        print("\n[2/4] 增量上传音频到服务器（只增不删）...")
        upload_staged(staging)

    # existing 是从现行清单解析来的，本身就含预设曲；不排掉就会和 preset 重复一份。
    # 同 id 的新条目要顶掉旧的——换格式重转时靠这一步把 .flac 的老记录换成 .m4a。
    preset_ids = {track["id"] for track in preset}
    replaced = {track["id"] for track in new_tracks}
    kept = [
        track
        for track in existing
        if track["id"] not in preset_ids and track["id"] not in replaced
    ]
    merged = preset + sorted(
        kept + [track for track in new_tracks if track["id"] not in preset_ids],
        key=lambda track: track["addedAt"],
        reverse=True,
    )
    MANIFEST_PATH.write_text(render_manifest(merged), encoding="utf-8")
    print(f"\n[3/4] 清单已重写: {MANIFEST_PATH.relative_to(ROOT)}（共 {len(merged)} 首）")

    if prune:
        print("\n==> 清理服务器上的孤儿文件（换格式后的旧文件在这一步消失）")
        prune_remote(merged)

    branch = current_branch()
    if not no_commit:
        if branch != "master" and not allow_any_branch:
            print(
                f"\n[ERROR] 当前分支是 {branch}，清单提交只允许在 master 上进行；"
                "切到 master 后重跑，或加 --allow-any-branch。",
                file=sys.stderr,
            )
            return 1
        try:
            run_cmd(["git", "add", str(MANIFEST_PATH.relative_to(ROOT))])
            run_cmd(
                [
                    "git",
                    "commit",
                    "-m",
                    f"feat(music): add {new_count} tracks from local music library",
                ]
            )
            run_cmd(["git", "push", "origin", branch])
            print("[OK] Git 提交与远程推送成功")
        except Exception as error:
            print(f"[WARN] Git 提交失败: {error}", file=sys.stderr)

    if not no_deploy:
        print("\n[4/4] 部署主站前端至 Azure 生产服务器...")
        try:
            run_cmd([find_bash(), "deploy/deploy-azure.sh", "main"])
            print("\n[SUCCESS] 曲库同步完成！")
            print("线上播放器: https://yiluohua.top/music")
        except Exception as error:
            print(f"[ERROR] 部署失败: {error}", file=sys.stderr)
            return 1
    else:
        print("\n[OK] 已完成收录与上传，跳过线上部署 (--no-deploy)。清单会在下次部署时生效。")

    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="自动将本地音乐同步至站点曲库并上线")
    parser.add_argument(
        "--source",
        type=Path,
        default=DEFAULT_SOURCE,
        help=f"音乐所在目录，默认: {DEFAULT_SOURCE}",
    )
    parser.add_argument("--dry-run", action="store_true", help="只检查新曲，不上传也不改清单")
    parser.add_argument("--no-commit", action="store_true", help="不自动提交推送 Git")
    parser.add_argument("--no-deploy", action="store_true", help="不上线到服务器")
    parser.add_argument(
        "--allow-any-branch",
        action="store_true",
        help="允许在非 master 分支上提交清单（默认拒绝）",
    )
    parser.add_argument(
        "--transcode",
        action="store_true",
        help=(
            f"无损文件转成 AAC {TRANSCODE_BITRATE}/{TRANSCODE_SAMPLE_RATE}Hz 再入库"
            "（已是有损且码率不高的原样收录）"
        ),
    )
    parser.add_argument(
        "--prune",
        action="store_true",
        help="删掉服务器上没有被清单引用的文件（换格式后的旧文件）",
    )
    parser.add_argument(
        "--ffmpeg",
        type=Path,
        default=None,
        help="ffmpeg 可执行文件路径，默认先找 PATH 再找已知安装位置",
    )
    parser.add_argument(
        "--album",
        default=None,
        help="只收录专辑标签包含该字符串的曲目（不分大小写）",
    )

    args = parser.parse_args()
    return sync_music(
        source_dir=args.source,
        dry_run=args.dry_run,
        no_commit=args.no_commit,
        no_deploy=args.no_deploy,
        allow_any_branch=args.allow_any_branch,
        transcode_audio=args.transcode,
        prune=args.prune,
        ffmpeg_path=args.ffmpeg,
        album_filter=args.album,
    )


if __name__ == "__main__":
    raise SystemExit(main())
