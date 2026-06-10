#!/usr/bin/env bash
# Run on UCloud host (via CI SSH). Installs binary, systemd, nginx /api proxy.
set -euo pipefail

INSTALL_DIR="/opt/acg-api"
DATA_DIR="/var/lib/acg-api"
BINARY_SRC="${1:?usage: remote-install-acg-api.sh <binary> [sudo_password] <unit-file>}"
SUDO_PASSWORD="${2:-}"
SERVICE_SRC="${3:?usage: remote-install-acg-api.sh <binary> [sudo_password] <unit-file>}"

run_sudo() {
  if [ -n "$SUDO_PASSWORD" ]; then
    echo "$SUDO_PASSWORD" | sudo -S -p '' "$@"
  else
    sudo "$@"
  fi
}

log_service_diagnostics() {
  local service="${1:?service required}"

  echo "=== $service status ===" >&2
  run_sudo systemctl --no-pager --full status "$service" >&2 || true
  echo "=== $service journal ===" >&2
  run_sudo journalctl -u "$service" -n 80 --no-pager >&2 || true
  echo "=== listening on 8787 ===" >&2
  run_sudo sh -c 'if command -v ss >/dev/null 2>&1; then ss -tlnp; else netstat -tlnp; fi' | grep -E ':(8787)[[:space:]]' || true
}

wait_for_service_active() {
  local service="${1:?service required}"
  local attempts="${2:-30}"
  local delay="${3:-1}"
  local state=""
  local i

  for i in $(seq 1 "$attempts"); do
    state="$(run_sudo systemctl is-active "$service" || true)"
    if [ "$state" = "active" ]; then
      echo "$service is active"
      return 0
    fi
    if [ "$state" = "failed" ]; then
      echo "$service entered failed state; status:" >&2
      log_service_diagnostics "$service"
      return 1
    fi

    echo "$service is $state; waiting..." >&2
    sleep "$delay"
  done

  echo "$service did not become active; status:" >&2
  log_service_diagnostics "$service"
  return 1
}

wait_for_http_ready() {
  local url="${1:?url required}"
  local attempts="${2:-30}"
  local delay="${3:-1}"
  local i

  for i in $(seq 1 "$attempts"); do
    if curl -fsS --max-time 2 "$url" >/dev/null; then
      echo "$url is ready"
      return 0
    fi

    echo "$url is not ready; waiting..." >&2
    sleep "$delay"
  done

  echo "$url did not become ready; diagnostics:" >&2
  log_service_diagnostics acg-api
  return 1
}

ensure_fail2ban() {
  if command -v fail2ban-server >/dev/null 2>&1; then
    run_sudo systemctl enable --now fail2ban || echo "warn: fail2ban enable failed" >&2
    return 0
  fi
  if command -v apt-get >/dev/null 2>&1; then
    run_sudo apt-get update || echo "warn: apt-get update failed for fail2ban" >&2
    run_sudo env DEBIAN_FRONTEND=noninteractive apt-get install -y fail2ban || {
      echo "warn: fail2ban install failed" >&2
      return 0
    }
    run_sudo systemctl enable --now fail2ban || echo "warn: fail2ban enable failed" >&2
    return 0
  fi
  echo "warn: fail2ban not installed; apt-get unavailable" >&2
}

install_sqlite_backup_cron() {
  local backup_dir="/var/backups/acg-api"
  local script="/usr/local/sbin/acg-api-backup-sqlite.sh"
  local cron="/etc/cron.d/acg-api-backup"
  local tmp_script tmp_cron

  tmp_script=$(mktemp)
  cat >"$tmp_script" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
DB="/var/lib/acg-api/acg.db"
OUT_DIR="/var/backups/acg-api"
mkdir -p "$OUT_DIR"
[ -f "$DB" ] || exit 0
if command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 /var/lib/acg-api/acg.db ".backup '$OUT_DIR/acg-$(date +%F).db'"
else
  cp "$DB" "$OUT_DIR/acg-$(date +%F).db"
fi
find "$OUT_DIR" -name 'acg-*.db' -type f -mtime +14 -delete
SH

  tmp_cron=$(mktemp)
  cat >"$tmp_cron" <<'CRON'
17 3 * * * root /usr/local/sbin/acg-api-backup-sqlite.sh >/dev/null 2>&1
CRON

  run_sudo mkdir -p "$backup_dir"
  run_sudo install -m 0755 "$tmp_script" "$script"
  run_sudo install -m 0644 "$tmp_cron" "$cron"
  rm -f "$tmp_script" "$tmp_cron"
}

if [ ! -f "$BINARY_SRC" ]; then
  echo "binary not found: $BINARY_SRC" >&2
  exit 1
fi
if [ ! -f "$SERVICE_SRC" ]; then
  echo "unit file not found: $SERVICE_SRC" >&2
  exit 1
fi

UNIT_CLEAN=$(mktemp)
sed 's/^\xEF\xBB\xBF//' "$SERVICE_SRC" | sed 's/\r$//' >"$UNIT_CLEAN"
if ! grep -q '^\[Unit\]' "$UNIT_CLEAN"; then
  echo "invalid unit file: missing [Unit] section" >&2
  cat "$UNIT_CLEAN" >&2
  exit 1
fi
if ! grep -q '^ExecStart=' "$UNIT_CLEAN"; then
  echo "invalid unit file: missing ExecStart=" >&2
  cat "$UNIT_CLEAN" >&2
  exit 1
fi

run_sudo mkdir -p "$INSTALL_DIR" "$DATA_DIR"
run_sudo install -m 0755 "$BINARY_SRC" "$INSTALL_DIR/acg-api"
run_sudo cp "$UNIT_CLEAN" /etc/systemd/system/acg-api.service
rm -f "$UNIT_CLEAN"

run_sudo systemctl daemon-reload
# verify may warn on optional paths; do not block deploy
if ! run_sudo systemd-analyze verify /etc/systemd/system/acg-api.service 2>&1; then
  echo "warn: systemd-analyze verify reported issues (continuing)" >&2
fi

run_sudo systemctl enable acg-api
if ! run_sudo systemctl restart acg-api; then
  echo "acg-api failed to start; journal:" >&2
  run_sudo journalctl -u acg-api -n 40 --no-pager >&2 || true
  exit 1
fi
if ! wait_for_service_active acg-api 30 1; then
  exit 1
fi
if ! wait_for_http_ready http://127.0.0.1:8787/api/v1/health 30 1; then
  exit 1
fi

ensure_fail2ban
install_sqlite_backup_cron

SECURITY_CONF="/etc/nginx/conf.d/taozhiyy-security-zones.conf"
SECURITY_TMP=$(mktemp)
cat >"$SECURITY_TMP" <<'NGX'
limit_req_zone $binary_remote_addr zone=api_guestbook:10m rate=5r/m;
limit_req_zone $binary_remote_addr zone=api_auth:10m rate=10r/m;
limit_req_zone $binary_remote_addr zone=api_chat:10m rate=30r/m;
NGX
run_sudo mkdir -p /etc/nginx/conf.d
run_sudo install -m 0644 "$SECURITY_TMP" "$SECURITY_CONF"
rm -f "$SECURITY_TMP"

SNIP="/etc/nginx/snippets/taozhiyy-acg-api.conf"
SNIP_TMP=$(mktemp)
cat >"$SNIP_TMP" <<'NGX'
client_max_body_size 10m;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

location = /api/guestbook/messages {
    limit_req zone=api_guestbook burst=10 nodelay;
    proxy_pass http://127.0.0.1:8787;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

location /api/auth/ {
    limit_req zone=api_auth burst=20 nodelay;
    proxy_pass http://127.0.0.1:8787;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

location = /api/chat {
    limit_req zone=api_chat burst=30 nodelay;
    proxy_pass http://127.0.0.1:8787;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

location = /api/ai/image {
    limit_req zone=api_chat burst=30 nodelay;
    proxy_pass http://127.0.0.1:8787;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

location /api/ {
    client_max_body_size 10m;
    proxy_pass http://127.0.0.1:8787;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
NGX
run_sudo mkdir -p /etc/nginx/snippets
run_sudo install -m 0644 "$SNIP_TMP" "$SNIP"
rm -f "$SNIP_TMP"

CONF=""
for f in /etc/nginx/sites-enabled/* /etc/nginx/conf.d/*.conf; do
  [ -f "$f" ] || continue
  if grep -q 'taozhiyy\.top' "$f" 2>/dev/null; then
    CONF="$f"
    break
  fi
done

if [ -n "$CONF" ] && ! grep -q 'taozhiyy-acg-api.conf' "$CONF"; then
  run_sudo sed -i '/server_name.*taozhiyy\.top/a\    include snippets/taozhiyy-acg-api.conf;' "$CONF"
fi

if ! run_sudo nginx -t 2>&1; then
  echo "nginx -t failed" >&2
  exit 1
fi
run_sudo systemctl reload nginx
