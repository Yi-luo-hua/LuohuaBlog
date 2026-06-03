"""
COS image uploader.

Usage:
  python upload_cos.py <image_path> [custom_filename]

Secrets are read from environment variables, or from /opt/acg-api/.env on
the server. This script intentionally has no hardcoded credentials.
"""

import os
import sys

from qcloud_cos import CosConfig, CosS3Client


def load_env():
    env_file = "/opt/acg-api/.env"
    if os.path.exists(env_file):
        with open(env_file, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip())


load_env()

SECRET_ID = os.environ.get("COS_SECRET_ID")
SECRET_KEY = os.environ.get("COS_SECRET_KEY")
REGION = os.environ.get("COS_REGION", "ap-beijing")
BUCKET = os.environ.get("COS_BUCKET")
PATH_PREFIX = os.environ.get("COS_PATH_PREFIX", "AI自动化博客图片/")


def require_config():
    missing = [
        name
        for name, value in {
            "COS_SECRET_ID": SECRET_ID,
            "COS_SECRET_KEY": SECRET_KEY,
            "COS_BUCKET": BUCKET,
        }.items()
        if not value
    ]
    if missing:
        raise SystemExit(
            f"Missing required environment variable(s): {', '.join(missing)}"
        )


def get_content_type(filepath):
    ext = os.path.splitext(filepath)[1].lower()
    return {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".gif": "image/gif",
        ".svg": "image/svg+xml",
        ".mp4": "video/mp4",
        ".mp3": "audio/mpeg",
    }.get(ext, "application/octet-stream")


def upload(filepath, custom_name=None):
    require_config()
    if not os.path.isfile(filepath):
        print(f"ERROR: file not found: {filepath}")
        return None

    config = CosConfig(Region=REGION, SecretId=SECRET_ID, SecretKey=SECRET_KEY)
    client = CosS3Client(config)

    ext = os.path.splitext(filepath)[1]
    name = custom_name or os.path.splitext(os.path.basename(filepath))[0]
    key = f"{PATH_PREFIX}{name}{ext}"
    ct = get_content_type(filepath)

    with open(filepath, "rb") as f:
        client.put_object(Bucket=BUCKET, Key=key, Body=f, ContentType=ct)

    url = f"https://{BUCKET}.cos.{REGION}.myqcloud.com/{key}"
    print(f"![]({url})")
    return url


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python upload_cos.py <image_path> [custom_name]")
        sys.exit(1)
    upload(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
