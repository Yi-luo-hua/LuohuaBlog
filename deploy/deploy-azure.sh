#!/usr/bin/env bash
# Build every subproject locally and upload it to the Azure VM.
#
# This is a push deploy, not a pull one: the server holds no git checkout and
# no build toolchain, so nothing on it needs Node, Go, or Hexo. Everything is
# built here and shipped as finished files.
#
# Three things on the server are never touched, because losing any one is
# unrecoverable from this repository:
#
#   ${API_DIR}/.env     every real secret; the repo only carries the key names
#   ${DATA_DIR}         the live SQLite database
#   ${WWW_DIR}/music    the music library; audio files are deliberately kept
#                       out of git (large binaries), so no deploy target can
#                       rebuild it — tools/sync_music.py owns that directory
#
# Usage:
#   deploy/deploy-azure.sh              # build and deploy everything
#   deploy/deploy-azure.sh main         # only the main site
#   deploy/deploy-azure.sh blog api     # any subset of: main blog api cos
set -euo pipefail

DEPLOY_HOST="${DEPLOY_HOST:-65.52.160.147}"
DEPLOY_USER="${DEPLOY_USER:-azureuser}"
DEPLOY_KEY="${DEPLOY_KEY:-E:/TOOLS/blog-server-key.pem}"

WWW_DIR="/var/www/luohua"
API_DIR="/opt/acg-api"
DATA_DIR="/var/lib/acg-api"

# The public host the browser will see. A bare IP resolves to http:// on its
# own (see main/src/lib/siteIdentity.js), so the built files need no patching
# afterwards; point this at a domain name and the same build turns into https.
SITE_HOST="${SITE_HOST:-yiluohua.top}"
SITE_APP_HOST="${SITE_APP_HOST:-app.yiluohua.top}"
VERIFY_ORIGIN="${VERIFY_ORIGIN:-https://$SITE_HOST}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BLOG_DB="$REPO_ROOT/blog/db.json"
BLOG_DB_BACKUP=""
BLOG_DB_STATE="idle"

restore_blog_db() {
  case "$BLOG_DB_STATE" in
    present)
      cp -p "$BLOG_DB_BACKUP" "$BLOG_DB"
      rm -f "$BLOG_DB_BACKUP"
      ;;
    absent)
      rm -f "$BLOG_DB"
      ;;
  esac
  BLOG_DB_BACKUP=""
  BLOG_DB_STATE="idle"
}

trap restore_blog_db EXIT

# Keep known_hosts beside the key rather than under ~/.ssh. Git Bash mangles a
# Windows home directory whose name is not ASCII, and ssh then fails to record
# the host key at all — which makes every scp abort with "Host key verification
# failed". An explicit ASCII path sidesteps that without weakening the check:
# the first connection pins the key, later ones verify against it.
DEPLOY_KNOWN_HOSTS="${DEPLOY_KNOWN_HOSTS:-${DEPLOY_KEY%/*}/known_hosts}"
SSH_OPTS=(
  -o BatchMode=yes
  -o ConnectTimeout=20
  -o StrictHostKeyChecking=accept-new
  -o "UserKnownHostsFile=$DEPLOY_KNOWN_HOSTS"
  -i "$DEPLOY_KEY"
)

targets=("$@")
if [ ${#targets[@]} -eq 0 ]; then
  targets=(main blog api cos)
fi

# npm ci deletes node_modules outright, which Windows refuses while a process
# still holds a native .node binding open — it fails with a bare EPERM after
# having already emptied the directory. Only the project whose modules are
# locked matters, so check the port that project's dev server uses.
check_no_dev_server() {
  local port="$1" project="$2"
  command -v powershell.exe >/dev/null 2>&1 || return 0
  if powershell.exe -NoProfile -Command        "if (Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue) { exit 1 } else { exit 0 }"        >/dev/null 2>&1; then
    return 0
  fi
  echo "a dev server is listening on $port; stop it before deploying $project (npm ci cannot replace locked files)" >&2
  exit 1
}

wants() {
  local want="$1"
  for t in "${targets[@]}"; do [ "$t" = "$want" ] && return 0; done
  return 1
}

remote() { ssh "${SSH_OPTS[@]}" "$DEPLOY_USER@$DEPLOY_HOST" "$@"; }

# Ship a local directory's contents into a remote directory, replacing what is
# there. tar over ssh keeps this to one round trip and needs no rsync, which
# Git Bash on Windows does not have.
upload_dir() {
  local src="$1" dest="$2"
  [ -d "$src" ] || { echo "missing build output: $src" >&2; exit 1; }
  remote "sudo mkdir -p '$dest' && sudo rm -rf '$dest'/* && sudo mkdir -p '$dest'"
  ( tar --warning=no-file-changed --warning=no-file-removed -C "$src" -czf - . || [ $? -le 1 ] ) |
    remote "sudo tar -C '$dest' -xzf - && sudo chown -R www-data:www-data '$dest' && sudo chmod -R 775 '$dest'"
}

sync_nginx_site_config() {
  local src="$REPO_ROOT/deploy/nginx-luohua.conf"
  [ -f "$src" ] || { echo "missing nginx site config: $src" >&2; exit 1; }

  echo "==> syncing nginx site config"
  scp "${SSH_OPTS[@]}" "$src" "$DEPLOY_USER@$DEPLOY_HOST:/tmp/luohua.nginx.new"
  remote '
    set -eu
    backup_dir=/var/backups/nginx
    backup="$backup_dir/luohua.before-deploy-$(date +%F-%H%M%S)"
    sudo mkdir -p "$backup_dir"
    sudo cp /etc/nginx/sites-available/luohua "$backup"
    sudo install -o root -g root -m 0644 /tmp/luohua.nginx.new /etc/nginx/sites-available/luohua
    rm -f /tmp/luohua.nginx.new
    if ! sudo nginx -t; then
      echo "nginx config invalid; restoring $backup" >&2
      sudo install -o root -g root -m 0644 "$backup" /etc/nginx/sites-available/luohua
      sudo nginx -t
      exit 1
    fi
    if ! sudo systemctl reload nginx; then
      echo "nginx reload failed; restoring $backup" >&2
      sudo install -o root -g root -m 0644 "$backup" /etc/nginx/sites-available/luohua
      sudo nginx -t
      sudo systemctl reload nginx
      exit 1
    fi
  '
}

echo "==> deploying [${targets[*]}] to $DEPLOY_USER@$DEPLOY_HOST"

if wants main; then check_no_dev_server 5173 "main"; fi
if wants blog; then check_no_dev_server 4000 "blog"; fi

if wants api; then
  echo "==> building acg-api (linux/amd64)"
  ( cd "$REPO_ROOT/acg-api" && go test ./... >/dev/null &&
    CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -o acg-api-linux-amd64 . )

  echo "==> uploading acg-api"
  # Upload beside the running binary, then swap and restart. The env file and
  # the database directory are left exactly as they are.
  scp "${SSH_OPTS[@]}" "$REPO_ROOT/acg-api/acg-api-linux-amd64" \
    "$DEPLOY_USER@$DEPLOY_HOST:/tmp/acg-api.new"
  remote "sudo install -o root -g root -m 0755 /tmp/acg-api.new '$API_DIR/acg-api' &&
          rm -f /tmp/acg-api.new &&
          sudo systemctl restart acg-api.service &&
          sudo systemctl is-active acg-api.service"
  rm -f "$REPO_ROOT/acg-api/acg-api-linux-amd64"
fi

if wants cos; then
  # Site media. These used to be reverse-proxied from a third party's storage
  # bucket; they live in this repository now so a rebuilt server gets them back
  # from a checkout rather than from somebody else's account.
  echo "==> uploading site media"
  upload_dir "$REPO_ROOT/assets/cos" "$WWW_DIR/cos"
fi

if wants main; then
  echo "==> building main site (SITE_HOST=$SITE_HOST)"
  ( cd "$REPO_ROOT/main" && npm ci &&
    VITE_API_BASE="" VITE_SITE_HOST="$SITE_HOST" VITE_SITE_APP_HOST="$SITE_APP_HOST" \
      npm run build )
  sleep 1
  echo "==> uploading main site"
  upload_dir "$REPO_ROOT/main/dist" "$WWW_DIR/main"
fi

if wants blog; then
  if [ -f "$BLOG_DB" ]; then
    BLOG_DB_BACKUP="$(mktemp)"
    cp -p "$BLOG_DB" "$BLOG_DB_BACKUP"
    BLOG_DB_STATE="present"
  else
    BLOG_DB_STATE="absent"
  fi

  echo "==> building blog"
  ( cd "$REPO_ROOT/blog" && npm ci && npm run clean >/dev/null && npm run build )
  echo "==> uploading blog"
  upload_dir "$REPO_ROOT/blog/public" "$WWW_DIR/blog"
  restore_blog_db
fi

sync_nginx_site_config

echo "==> verifying"
for path in / /blog/ /api/v1/health; do
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 \
    --retry 3 --retry-all-errors --retry-delay 2 "$VERIFY_ORIGIN$path" || true)"
  printf '    %-20s %s\n' "$path" "$code"
  [ "$code" = "200" ] || { echo "    FAILED: $path returned $code" >&2; exit 1; }
done

echo "==> done"
