#!/usr/bin/env bash
# Run on UCloud host (via CI SSH). Installs binary, systemd, nginx /api proxy.
set -euo pipefail

INSTALL_DIR="/opt/acg-api"
DATA_DIR="/var/lib/acg-api"
BINARY_SRC="${1:?usage: remote-install-acg-api.sh /path/to/acg-api-binary [sudo_password]}"
SUDO_PASSWORD="${ACG_SUDO_PASS:-${2:-}}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_SRC="${SCRIPT_DIR}/acg-api.service"
NGINX_SNIP_SRC="${SCRIPT_DIR}/nginx-acg-api.snippet"

strip_cr() {
  sed 's/\r$//' "$1"
}

run_sudo() {
  if [ -n "$SUDO_PASSWORD" ]; then
    echo "$SUDO_PASSWORD" | sudo -S -p '' "$@"
  else
    sudo "$@"
  fi
}

install_unit_file() {
  local src="$1"
  local dest="$2"
  local tmp
  tmp="$(mktemp)"
  strip_cr "$src" >"$tmp"
  run_sudo install -m 0644 "$tmp" "$dest"
  rm -f "$tmp"
}

if [ ! -f "$SERVICE_SRC" ]; then
  echo "missing $SERVICE_SRC" >&2
  exit 1
fi
if [ ! -f "$NGINX_SNIP_SRC" ]; then
  echo "missing $NGINX_SNIP_SRC" >&2
  exit 1
fi

run_sudo mkdir -p "$INSTALL_DIR" "$DATA_DIR"
run_sudo install -m 0755 "$BINARY_SRC" "$INSTALL_DIR/acg-api"

install_unit_file "$SERVICE_SRC" /etc/systemd/system/acg-api.service

run_sudo systemctl daemon-reload
run_sudo systemctl enable acg-api
if ! run_sudo systemctl restart acg-api; then
  run_sudo systemctl status acg-api --no-pager || true
  run_sudo sed -n '1,120p' /etc/systemd/system/acg-api.service || true
  exit 1
fi

SNIP="/etc/nginx/snippets/taozhiyy-acg-api.conf"
run_sudo mkdir -p /etc/nginx/snippets
install_unit_file "$NGINX_SNIP_SRC" "$SNIP"

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
