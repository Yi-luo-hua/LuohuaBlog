# acg-api (minimal Go)

Lightweight API for guestbook (SQLite) and Bilibili tracker placeholders.

## Config (built-in defaults)

- Bilibili UID: `1061280173` (override `BILIBILI_UID`)
- Radar creators:
  - 罗翔说刑法 `517327498`
  - 你的影月月 `431073645`
  - 黑马程序员 `37974444`
  - 挪威的月亮 `398915225`

Sync: bangumi every **1h**, radar every **15m**, image cache cleanup **7 days**.

## Run locally

```bash
cd acg-api
go run .
```

Default listen: `:8787`

Trigger manual sync: `POST /api/v1/sync/trigger`

## Endpoints

- `GET /api/v1/health`
- `GET /api/v1/guestbook?limit=50`
- `POST /api/v1/guestbook` — JSON `{ "name": "...", "content": "..." }`
- `GET /api/v1/bangumi/list`
- `GET /api/v1/radar/feed`
- `GET /api/chat` — quota status (blog AI assistant)
- `POST /api/chat` — `{ "message": "..." }` → DeepSeek-v4-flash (see `blog/AI-ASSISTANT.md`)

Copy `.env.example` → `/opt/acg-api/.env` with `DEEPSEEK_API_KEY`.

## Frontend

In `main/`, set for production build:

```env
VITE_API_BASE=https://taozhiyy.top
```

Dev: Vite proxies `/api` → `http://127.0.0.1:8787`.

## Deploy on UCloud (outline)

1. Build: `CGO_ENABLED=0 go build -o acg-api .`
2. systemd unit runs `./acg-api` with `ACG_DATA_DIR=/var/lib/acg-api`
3. Nginx:

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:8787;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
}
```

Image cache (later): serve `/api/v1/acg/image/` via Nginx `alias` + `sendfile`, not through Go.

## Memory

Stdlib `net/http` + SQLite file DB. No Docker. Typical RSS **~60–180MB** under light load.
