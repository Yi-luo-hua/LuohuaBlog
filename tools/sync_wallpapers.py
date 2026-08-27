#!/usr/bin/env python3
"""自动将本地壁纸插图同步至博客相册并部署上线。

默认监听/读取：F:\图\表情包壁纸\壁纸插图
工作流程：
1. 扫描目标目录中的新图片（自动跳过已存在的图片）；
2. 生成 900px 高性能 Web 缩略图并优化原图体积；
3. 自动将图片写入 assets/cos/gallery/ 并更新 main/src/data/galleryPhotos.js；
4. 自动提交 Git 并推送至 GitHub 仓库；
5. 自动调用 deploy-azure.sh 将相册媒体与前端构建部署至生产服务器。
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path

# 防止 Windows 终端在输出 Unicode 符号时抛出 GBK 编码错误
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))

from gallery_ingest import ingest

DEFAULT_SOURCE = Path(r"F:\图\表情包壁纸\壁纸插图")


def find_bash() -> str:
    git_bash = Path(r"C:\Program Files\Git\bin\bash.exe")
    if git_bash.is_file():
        return str(git_bash)
    return "bash"


def run_cmd(cmd: list[str], cwd: Path | None = None) -> None:
    print(f"\n==> 执行命令: {' '.join(cmd)}")
    res = subprocess.run(cmd, cwd=cwd or ROOT, text=True)
    if res.returncode != 0:
        raise RuntimeError(f"命令执行失败 (code {res.returncode}): {' '.join(cmd)}")


def sync_wallpapers(
    source_dir: Path,
    dry_run: bool = False,
    no_commit: bool = False,
    no_deploy: bool = False,
    keep_png: bool = False,
) -> int:
    print("==================================================")
    print("   伊洛华博客相册 · 本地壁纸自动化同步工具")
    print(f"   源目录: {source_dir}")
    print("==================================================")

    if not source_dir.is_dir():
        print(f"错误: 找不到目录 {source_dir}", file=sys.stderr)
        return 1

    print("\n[1/3] 扫描并处理新图片...")
    written = ingest(
        source_dir=source_dir,
        album_prefix="gallery",
        dry_run=dry_run,
        keep_original_bytes=keep_png,
    )

    if written == 0:
        print("\n[OK] 未检测到新照片，相册已是最新状态，无需重新部署。")
        return 0

    if dry_run:
        print(f"\n[dry-run 模式] 预计可收录 {written} 张新图片，未执行实际写入和部署。")
        return 0

    # 提交到 Git
    if not no_commit:
        print(f"\n[2/3] 提交本地变更至 GitHub 仓库...")
        try:
            run_cmd(["git", "add", "assets/cos/gallery", "main/src/data/galleryPhotos.js"])
            run_cmd(["git", "commit", "-m", f"feat(gallery): add {written} new photos from local wallpaper library"])
            run_cmd(["git", "push", "origin", "master"])
            print("[OK] Git 提交与远程推送成功")
        except Exception as e:
            print(f"[WARN] Git 提交失败: {e}", file=sys.stderr)

    # 部署到 Azure
    if not no_deploy:
        print(f"\n[3/3] 部署相册媒体与前端至 Azure 生产服务器...")
        bash = find_bash()
        deploy_script = "deploy/deploy-azure.sh"
        try:
            run_cmd([bash, deploy_script, "cos", "main"])
            print("\n[SUCCESS] 相册部署上线完成！")
            print("线上相册地址: https://yiluohua.top/gallery")
        except Exception as e:
            print(f"[ERROR] 部署失败: {e}", file=sys.stderr)
            return 1
    else:
        print("\n[OK] 已完成本地收录，已跳过线上部署 (--no-deploy)。")

    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="自动将本地壁纸同步至博客相册并上线")
    parser.add_argument(
        "--source",
        type=Path,
        default=DEFAULT_SOURCE,
        help=f"照片所在目录，默认: {DEFAULT_SOURCE}",
    )
    parser.add_argument("--dry-run", action="store_true", help="只检查新图，不实际写入和部署")
    parser.add_argument("--no-commit", action="store_true", help="不自动提交推送 Git")
    parser.add_argument("--no-deploy", action="store_true", help="只收录到本地，不上线到服务器")
    parser.add_argument("--keep-png", action="store_true", help="PNG 图片原样保留不转 JPEG")

    args = parser.parse_args()
    return sync_wallpapers(
        source_dir=args.source,
        dry_run=args.dry_run,
        no_commit=args.no_commit,
        no_deploy=args.no_deploy,
        keep_png=args.keep_png,
    )


if __name__ == "__main__":
    raise SystemExit(main())
