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

if [ ! -f "$BINARY_SRC" ]; then
  echo "binary not found: $BINARY_SRC" >&2
  exit 1
fi
if [ ! -f "$SERVICE_SRC" ]; then
  echo "unit file not found: $SERVICE_SRC" >&2
  exit 1
fi

run_sudo mkdir -p "$INSTALL_DIR" "$DATA_DIR"
run_sudo install -m 0755 "$BINARY_SRC" "$INSTALL_DIR/acg-api"

# Strip Windows CRLF / stray BOM so systemd parses [Unit] correctly
sed 's/^\xEF\xBB\xBF//' "$SERVICE_SRC" | sed 's/\r$//' | run_sudo tee /etc/systemd/system/acg-api.service >/dev/null

run_sudo systemctl daemon-reload
if ! run_sudo systemd-analyze verify /etc/systemd/system/acg-api.service 2>/dev/null; then
  echo "systemd unit verify failed; unit file dump:" >&2
  run_sudo sed -n '1,40p' /etc/systemd/system/acg-api.service >&2 || true
  exit 1
fi

run_sudo systemctl enable acg-api
run_sudo systemctl restart acg-api

SNIP="/etc/nginx/snippets/taozhiyy-acg-api.conf"
if ! run_sudo test -f "$SNIP"; then
  run_sudo mkdir -p /etc/nginx/snippets
  run_sudo tee "$SNIP" >/dev/null <<'NGX'
location /api/ {
    proxy_pass http://127.0.0.1:8787;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
NGX
fi

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

run_sudo nginx -t
run_sudo systemctl reload nginx
run_sudo systemctl is-active acg-api
