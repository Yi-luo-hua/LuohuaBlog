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
- `POST /api/chat` — `{ "message": "...", "pageUrl", "pageTitle" }` → DeepSeek-v4-flash (see `blog/AI-ASSISTANT.md`)
- `POST /api/auth/register` — 邮箱注册（站长邮箱不可注册）
- `POST /api/auth/login` — 登录；站长邮箱需再调 `verify-security`
- `POST /api/auth/verify-security` — `{ "challengeToken", "answer" }` 学号验证 → 无限 AI
- `POST /api/auth/logout` / `GET /api/auth/me`

### 留言小纸条（`/api/guestbook/`）

自研轻量留言板，复用 `acg_session` 登录态；支持匿名与登录用户留言，站长（`is_owner`）可删/隐藏。

建表：启动时自动创建 `guestbook_messages`（见 `deploy/guestbook.sql`）。

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/guestbook/messages?page=1&pageSize=20` | 列表；普通用户仅 `visible`，管理员含 `hidden` |
| POST | `/api/guestbook/messages` | 发布；匿名 `{ nickname, content }`，登录 `{ content }` |
| DELETE | `/api/guestbook/messages/:id` | 软删除（`deleted`），仅 admin |
| PATCH | `/api/guestbook/messages/:id/status` 或 `/:id` | `{ "status": "hidden" }`，仅 admin |

限流：匿名 3/小时、10/天；登录 10/小时、30/天；60 秒内同内容防重复。429 返回 `RATE_LIMITED`。

IP：仅存 `ip_hash`、`ip_masked`；公开展示 `ipRegion`（依赖 `ip-api.com`，失败时为「未知地区」）。

前端页面：`main/` 路由 `/guestbook`，首页 Story「LEAVE A MESSAGE」入口。

Copy `.env.example` → `/opt/acg-api/.env` with `DEEPSEEK_API_KEY`, `AUTH_OWNER_PASSWORD`, `AUTH_OWNER_SECURITY_ANSWER`（站长 `173236231@qq.com` 学号二次验证）。

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
