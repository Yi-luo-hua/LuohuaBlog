#!/usr/bin/env python3
"""自动将本地音乐文件同步至站点曲库并部署上线。

与相册（assets/cos/，随仓库走）不同，音频文件体积大，刻意不进 git：
音频只上传到服务器 /var/www/luohua/music/（Nginx 以 /audio/ 读盘），
仓库里只保留播放清单 main/src/data/musicTracks.js（元数据 + URL）。

默认源目录：脚本顶部的 DEFAULT_SOURCE，可用 --source 覆盖。
工作流程：
1. 扫描源目录中的音频（.mp3/.m4a/.flac/.ogg/.wav），按内容 sha1 前 16 位命名；
2. mutagen 读标题/歌手/专辑/时长，Pillow 提取内嵌封面（≤500px JPEG）；
3. 仅新文件经 tar over ssh 增量上传（只增不删，不经过 deploy-azure.sh 的
   清空式 upload_dir，主站部署永远不会碰到这个目录）；
4. 重写 musicTracks.js（PRESET 首曲 + 历史条目合并 + 新曲按时间倒序）；
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
DEFAULT_SOURCE = Path(r"F:\音乐")
COVER_MAX_PX = 500

# 与 deploy/deploy-azure.sh 保持同一套 SSH 约定：密钥在仓库外，known_hosts
# 放在密钥旁边（Git Bash 处理不了含非 ASCII 的 home 目录）。
DEPLOY_HOST = "65.52.160.147"
DEPLOY_USER = "azureuser"
DEPLOY_KEY = Path("E:/TOOLS/blog-server-key.pem")
DEPLOY_KNOWN_HOSTS = DEPLOY_KEY.parent / "known_hosts"

SERVER_MUSIC_DIR = "/var/www/luohua/music"
MANIFEST_PATH = ROOT / "main" / "src" / "data" / "musicTracks.js"
PRESET_AUDIO_FILE = ROOT / "assets" / "cos" / "AI自动化博客图片" / "main" / "audio" / "loop.mp3"

# 仓库自带的循环 BGM：文件无标签，元数据硬编码；src 必须保持 URL 编码原样
# （照抄 Navbar.jsx 的写法，手写成解码后的中文目录会 404）。
PRESET_TRACKS = [
    {
        "id": "preset-loop",
        "title": "it's 6pm but I miss u already",
        "artist": "YaoNie",
        "album": "",
        "src": "/cos/AI%E8%87%AA%E5%8A%A8%E5%8C%96%E5%8D%9A%E5%AE%A2%E5%9B%BE%E7%89%87/main/audio/loop.mp3",
        "cover": None,
        "duration": 0.0,
        "addedAt": "2026-08-30T00:00:00Z",
    },
]

MANIFEST_HEADER = """// 播放清单。数组顺序即页面展示顺序，新歌在前面；tools/sync_music.py 重新生成时
// 会整体覆盖本文件，所以长期曲目请维护在那个脚本的 PRESET_TRACKS 常量里。
//
// 每条的字段：
//   id        唯一标识（音频内容 sha1 前 16 位），播放器状态恢复靠它定位
//   title     歌名；无标签文件由同步脚本用文件名兜底
//   artist    歌手
//   album     可选，专辑名
//   src       音频地址；自托管曲库是 /audio/<id>.<ext>，
//             仓库自带的曲子仍走 /cos/ 前缀（中文路径必须保持 URL 编码原样）
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


def content_id(path: Path) -> str:
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
        value = tags.get(key)
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
    elif hasattr(tags, "pictures"):  # FLAC
        vorbis = tags.as_dict()
        title, artist, album = (
            first_text(vorbis, "title"),
            first_text(vorbis, "artist"),
            first_text(vorbis, "album"),
        )
        if tags.pictures:
            cover = tags.pictures[0].data
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
    tracks = [dict(entry) for entry in PRESET_TRACKS]
    try:
        audio = MutagenFile(str(PRESET_AUDIO_FILE))
        if audio is not None and audio.info:
            tracks[0]["duration"] = round(audio.info.length, 2)
    except Exception:
        pass
    return tracks


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
    body = ",\n\n".join(render_track(track) for track in tracks)
    return MANIFEST_HEADER + body + "\n" + MANIFEST_FOOTER


def ingest_source(source_dir: Path, staging: Path, known_ids: set[str]) -> list[dict]:
    """扫描源目录，把新曲目拷贝成 {id}.{ext} 并提取封面，返回新条目列表。"""
    files = sorted(
        (p for p in source_dir.iterdir() if p.suffix.lower() in AUDIO_EXTS and p.is_file()),
        key=lambda p: p.stat().st_mtime,
    )
    new_tracks: list[dict] = []
    for path in files:
        tid = content_id(path)
        if tid in known_ids:
            continue
        title, artist, album, cover_raw = read_tags(path)
        ext = path.suffix.lower()
        staged_audio = staging / f"{tid}{ext}"
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
                "duration": round(_duration_seconds(path), 2),
                "addedAt": added_at.strftime("%Y-%m-%dT%H:%M:%SZ"),
            }
        )
        known_ids.add(tid)
        print(
            f"  + {path.name} -> {tid}{ext}"
            f"  [{new_tracks[-1]['title']} / {new_tracks[-1]['artist']}]"
        )
    return new_tracks


def _duration_seconds(path: Path) -> float:
    audio = MutagenFile(str(path))
    if audio is not None and audio.info:
        return float(audio.info.length)
    return 0.0


def upload_staged(staging: Path) -> int:
    """把 staging 里服务器上还没有的文件增量传上去（只增不删）。"""
    remote_names = set()
    try:
        remote_names = {
            line.strip()
            for line in run_remote(f"sudo ls -1 {SERVER_MUSIC_DIR} 2>/dev/null || true").splitlines()
            if line.strip()
        }
    except RuntimeError as error:
        print(f"[WARN] 读取服务器目录失败，将全量上传本次文件: {error}", file=sys.stderr)

    pending = sorted(
        p.name for p in staging.iterdir() if p.name not in remote_names
    )
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
) -> int:
    print("=" * 50)
    print("   伊洛华站点 · 本地音乐库同步工具")
    print(f"   源目录: {source_dir}")
    print("=" * 50)

    if not source_dir.is_dir():
        print(f"错误: 找不到目录 {source_dir}", file=sys.stderr)
        return 1

    existing = parse_existing_tracks()
    preset = preset_tracks()
    known_ids = {track["id"] for track in existing + preset}

    print(f"\n[1/4] 扫描新曲目（清单已有 {len(existing) + len(preset)} 首）...")
    with tempfile.TemporaryDirectory(prefix="music-sync-") as tmp:
        staging = Path(tmp)
        new_tracks = ingest_source(source_dir, staging, known_ids)
        new_count = len(new_tracks)

        if new_count == 0:
            print("\n[OK] 未检测到新曲目，清单已是最新，无需部署。")
            return 0
        if dry_run:
            print(f"\n[dry-run 模式] 预计可收录 {new_count} 首新曲目，未上传也未改清单。")
            return 0

        print(f"\n[2/4] 增量上传音频到服务器（只增不删）...")
        upload_staged(staging)

    merged = preset + sorted(
        existing + new_tracks,
        key=lambda track: track["addedAt"],
        reverse=True,
    )
    MANIFEST_PATH.write_text(render_manifest(merged), encoding="utf-8")
    print(f"\n[3/4] 清单已重写: {MANIFEST_PATH.relative_to(ROOT)}（共 {len(merged)} 首）")

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

    args = parser.parse_args()
    return sync_music(
        source_dir=args.source,
        dry_run=args.dry_run,
        no_commit=args.no_commit,
        no_deploy=args.no_deploy,
        allow_any_branch=args.allow_any_branch,
    )


if __name__ == "__main__":
    raise SystemExit(main())
