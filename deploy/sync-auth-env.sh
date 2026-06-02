#!/usr/bin/env bash
# Merge auth vars into /opt/acg-api/.env (run on server). Does not remove other keys.
set -euo pipefail

ENV_FILE="/opt/acg-api/.env"
FRAGMENT="${1:-}"

run_sudo() {
  if [ -n "${SUDO_PASSWORD:-}" ]; then
    echo "$SUDO_PASSWORD" | sudo -S -p '' "$@"
  else
    sudo "$@"
  fi
}

run_sudo mkdir -p "$(dirname "$ENV_FILE")"
run_sudo touch "$ENV_FILE"
run_sudo chmod 600 "$ENV_FILE"

load_fragment_to_env() {
  local frag="$1"
  [ -f "$frag" ] || return 0
  while IFS= read -r line || [ -n "$line" ]; do
    line="${line//$'\r'/}"
    [[ "$line" =~ ^#.*$ || -z "$line" ]] && continue
    key="${line%%=*}"
    val="${line#*=}"
    case "$key" in
      AUTH_OWNER_PASSWORD|AUTH_OWNER_SECURITY_ANSWER|AUTH_SESSION_DAYS)
        export "$key"="$val"
        ;;
    esac
  done <"$frag"
  rm -f "$frag"
}

merge_keys_python() {
  if ! command -v python3 >/dev/null 2>&1; then
    echo "error: python3 is required on the server to merge auth env" >&2
    exit 1
  fi
  local src merged
  src=$(mktemp)
  merged=$(mktemp)
  run_sudo cat "$ENV_FILE" >"$src" 2>/dev/null || : >"$src"
  python3 - "$src" "$merged" <<'PY'
import os, re, sys

src_path, out_path = sys.argv[1], sys.argv[2]
allowed = ("AUTH_OWNER_PASSWORD", "AUTH_OWNER_SECURITY_ANSWER", "AUTH_SESSION_DAYS")
updates = {k: os.environ.get(k, "").strip() for k in allowed}
updates = {k: v for k, v in updates.items() if v}
try:
    with open(src_path, "r", encoding="utf-8") as f:
        lines = f.readlines()
except FileNotFoundError:
    lines = []
out, seen = [], set()
for line in lines:
    m = re.match(r"^([A-Z0-9_]+)=", line)
    if m and m.group(1) in updates:
        if m.group(1) not in seen:
            out.append(f"{m.group(1)}={updates[m.group(1)]}\n")
            seen.add(m.group(1))
        continue
    out.append(line)
for k, v in updates.items():
    if k not in seen:
        if out and not out[-1].endswith("\n"):
            out.append("\n")
        out.append(f"{k}={v}\n")
with open(out_path, "w", encoding="utf-8") as f:
    f.writelines(out)
PY
  run_sudo cp "$merged" "$ENV_FILE"
  run_sudo chmod 600 "$ENV_FILE"
  rm -f "$src" "$merged"
}

if [ -n "$FRAGMENT" ]; then
  load_fragment_to_env "$FRAGMENT"
fi

merge_keys_python

if run_sudo grep -q '^AUTH_OWNER_PASSWORD=' "$ENV_FILE" 2>/dev/null; then
  if run_sudo systemctl restart acg-api; then
    echo "auth env synced; acg-api restarted"
  else
    echo "error: acg-api restart failed" >&2
    run_sudo systemctl status acg-api --no-pager >&2 || true
    exit 1
  fi
else
  echo "warn: AUTH_OWNER_PASSWORD not set in $ENV_FILE (skip restart)"
  exit 1
fi
