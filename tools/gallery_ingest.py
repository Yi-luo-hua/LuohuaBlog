#!/usr/bin/env python3
"""把本地照片收进站内相册。

站长控制台走的是「上传到腾讯 COS」那条路，需要服务器上配好密钥。这个脚本走另一条：
照片直接放进仓库的 assets/cos/gallery/ 下，`deploy/deploy-azure.sh cos` 会同步到
服务器，Nginx 从本地磁盘发出去。两条路写进 galleryPhotos.js 的条目格式完全一致。

顺带做三件手动做很烦的事：读出原始像素宽高、生成列表页用的缩略图、按时间倒序插入。

    python tools/gallery_ingest.py "F:/图/壁纸" --dry-run
    python tools/gallery_ingest.py "F:/图/壁纸"
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GALLERY_DATA = ROOT / "main" / "src" / "data" / "galleryPhotos.js"
MEDIA_ROOT = ROOT / "assets" / "cos"
ARRAY_DECL = "export const galleryPhotos = ["

# 和 acg-api/owner_thumbnail.go 保持一致：列表页等高行最高 300px，2x 屏 600px。
THUMB_MAX_EDGE = 900
THUMB_QUALITY = 82

# 全分辨率重新编码。q90 在插画上肉眼无损，体积通常只有原 PNG 的四分之一。
FULL_QUALITY = 90

SUPPORTED_SUFFIXES = {".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"}


@dataclass(frozen=True)
class Photo:
    photo_id: str
    src: str
    thumb: str
    width: int
    height: int
    published_at: str


def js_string(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)


def photo_id_for(src: str, taken_at: datetime) -> str:
    """和 Go 那边 ownerGalleryPhotoIDFor 同构：时间戳 + 地址摘要。"""
    digest = hashlib.sha1(src.encode("utf-8")).hexdigest()[:6]
    return taken_at.astimezone(timezone.utc).strftime("%Y%m%d-%H%M%S") + "-" + digest


def render_entry(photo: Photo) -> str:
    """字段顺序要和 newGalleryPhotoLiteral 一致，两边写出来的文件才长得一样。"""
    lines = [
        "  {",
        f"    id: {js_string(photo.photo_id)},",
        f"    src: {js_string(photo.src)},",
        f"    width: {photo.width},",
        f"    height: {photo.height},",
    ]
    if photo.thumb:
        lines.append(f"    thumb: {js_string(photo.thumb)},")
    lines.append(f"    publishedAt: {js_string(photo.published_at)},")
    lines.append("  },")
    return "\n".join(lines) + "\n"


def existing_sources(source: str) -> set[str]:
    """已经在相册里的图片地址，用来避免重复收录。"""
    found = set()
    for line in source.splitlines():
        stripped = line.strip()
        for field in ("src:", "thumb:"):
            if stripped.startswith(field):
                value = stripped[len(field):].strip().rstrip(",")
                try:
                    found.add(json.loads(value))
                except json.JSONDecodeError:
                    pass
    return found


def insert_entries(source: str, photos: list[Photo]) -> str:
    """插到数组开头——相册按发布时间倒序展示，新的排在最前面。"""
    if not photos:
        return source

    array_open = source.index(ARRAY_DECL) + source[source.index(ARRAY_DECL):].index("[")
    body = "".join(render_entry(photo) for photo in photos)
    return source[: array_open + 1] + "\n" + body + source[array_open + 1 :]


def load_pillow():
    try:
        from PIL import Image
    except ImportError:  # pragma: no cover - 依赖缺失时给出可操作的提示
        sys.exit("需要 Pillow：pip install Pillow")
    Image.MAX_IMAGE_PIXELS = None
    return Image


def ingest(
    source_dir: Path,
    album_prefix: str,
    dry_run: bool,
    keep_original_bytes: bool,
) -> int:
    Image = load_pillow()

    if not source_dir.is_dir():
        sys.exit(f"找不到目录：{source_dir}")

    data = GALLERY_DATA.read_text(encoding="utf-8")
    already = existing_sources(data)

    candidates = sorted(
        (p for p in source_dir.iterdir() if p.is_file() and p.suffix.lower() in SUPPORTED_SUFFIXES),
        key=lambda p: p.stat().st_mtime,
    )
    if not candidates:
        sys.exit(f"{source_dir} 下没有找到可用的图片")

    photos: list[Photo] = []
    written = skipped = 0
    total_before = total_after = 0

    for path in candidates:
        taken_at = datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc)
        image = Image.open(path)
        image.load()
        width, height = image.size

        has_alpha = image.mode in ("RGBA", "LA") and image.getchannel("A").getextrema()[0] < 255
        # 真的用到透明就留 PNG，其余一律转 JPEG——插画 PNG 动辄十几 MB。
        as_png = has_alpha or keep_original_bytes and path.suffix.lower() == ".png"
        suffix = ".png" if as_png else ".jpg"

        digest = hashlib.sha1(path.read_bytes()).hexdigest()[:16]
        rel_dir = f"{album_prefix}/{taken_at:%Y}/{taken_at:%m}"
        rel_full = f"{rel_dir}/{digest}{suffix}"
        rel_thumb = f"{rel_dir}/{digest}-thumb.jpg"
        src_url = "/cos/" + rel_full
        thumb_url = "/cos/" + rel_thumb

        if src_url in already:
            skipped += 1
            continue

        buffer = io.BytesIO()
        if as_png:
            image.save(buffer, "PNG", optimize=True)
        else:
            image.convert("RGB").save(buffer, "JPEG", quality=FULL_QUALITY, optimize=True)
        full_bytes = buffer.getvalue()

        thumb = image.convert("RGB").copy()
        thumb.thumbnail((THUMB_MAX_EDGE, THUMB_MAX_EDGE), Image.LANCZOS)
        buffer = io.BytesIO()
        thumb.save(buffer, "JPEG", quality=THUMB_QUALITY, optimize=True)
        thumb_bytes = buffer.getvalue()

        total_before += path.stat().st_size
        total_after += len(full_bytes) + len(thumb_bytes)

        if not dry_run:
            (MEDIA_ROOT / rel_dir).mkdir(parents=True, exist_ok=True)
            (MEDIA_ROOT / rel_full).write_bytes(full_bytes)
            (MEDIA_ROOT / rel_thumb).write_bytes(thumb_bytes)

        photos.append(
            Photo(
                photo_id=photo_id_for(src_url, taken_at),
                src=src_url,
                thumb=thumb_url,
                width=width,
                height=height,
                published_at=taken_at.strftime("%Y-%m-%dT%H:%M:%SZ"),
            )
        )
        written += 1
        print(
            f"  {path.name[:44]:44} {width:>5}x{height:<5} "
            f"{path.stat().st_size/1e6:6.1f} MB -> {len(full_bytes)/1e6:5.1f} MB "
            f"(+{len(thumb_bytes)/1e3:4.0f} KB 缩略图){' [PNG]' if as_png else ''}"
        )

    # 数组开头是最新的，所以倒着插。
    photos.reverse()

    if not dry_run and photos:
        GALLERY_DATA.write_text(insert_entries(data, photos), encoding="utf-8", newline="\n")

    print(
        f"\n{'[dry-run] ' if dry_run else ''}收录 {written} 张"
        f"{f'，跳过 {skipped} 张已存在' if skipped else ''}："
        f"{total_before/1e6:.1f} MB -> {total_after/1e6:.1f} MB"
    )
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="把本地照片收进站内相册")
    parser.add_argument("source", type=Path, help="照片所在目录")
    parser.add_argument("--prefix", default="gallery", help="assets/cos 下的子目录，默认 gallery")
    parser.add_argument("--dry-run", action="store_true", help="只算不写")
    parser.add_argument(
        "--keep-png",
        action="store_true",
        help="PNG 原样保留而不转 JPEG（体积会大很多）",
    )
    args = parser.parse_args()
    return ingest(args.source, args.prefix.strip("/"), args.dry_run, args.keep_png)


if __name__ == "__main__":
    raise SystemExit(main())
