# acg-api (minimal Go)

Lightweight API for the Bangumi watching shelf and the site's other SQLite-backed services.

## Bangumi config

- `BANGUMI_ACCESS_TOKEN` is required for the personal watching shelf.
- `BANGUMI_API_BASE_URL` defaults to `https://api.bgm.tv`.
- The backend calls `/v0/me`, then reads anime collections with `subject_type=2` and collection types `3` (在看), `2` (看过), and `1` (想看).
- Keep the real token in local `acg-api/.env` or server `/opt/acg-api/.env`; never expose it through a `VITE_` variable.

Sync: Bangumi every **1h**, image cache cleanup **7 days**.

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
- `GET /api/v1/bangumi/list?status=watching|watched|wish`
- `GET /api/owner/gate` — 这台浏览器是否已解锁 `{ "unlocked", "configured" }`
- `POST /api/owner/gate` — `{ "password" }`，对上 `OWNER_GATE_PASSWORD` 就下发 `acg_session` cookie
- `DELETE /api/owner/gate` — 锁回去，清掉这台设备的会话

### 站长控制器（`/api/owner/`）

站上没有账号体系：拿着 `acg_session` cookie 就是站长，而这个 cookie 只能由 `POST /api/owner/gate` 用正确的 `OWNER_GATE_PASSWORD` 换到。浏览器只提交内容、图片或公开 URL，GitHub Token、COS 密钥等写入凭据保留在服务器环境变量里。

| 方法 | 路径 | 控制器文件 | 说明 |
|------|------|------|------|
| GET | `/api/owner/status` | `owner_controller.go` | 返回未读留言提醒、草稿和上传限制。 |
| GET/POST | `/api/owner/drafts` | `owner_controller.go` | 读取和保存站长草稿。 |
| PATCH | `/api/owner/notifications/:id/read` | `owner_controller.go` | 只写入 `owner_read_at`，不会隐藏公开留言。 |
| POST | `/api/owner/uploads` | `owner_controller.go` | 保存本地临时图片到 `ACG_DATA_DIR/owner-uploads`，最大 8 MiB。 |
| GET | `/api/owner/uploads/:name` | `owner_controller.go` | 读取本地临时上传图片。 |
| POST | `/api/owner/assets` | `owner_controller.go` + `owner_cos.go` | 使用服务器端 COS 凭据上传文章/相册图片，返回公开 URL 和对象 key。 |
| POST | `/api/owner/publish` | `owner_publish.go` | 发布 Markdown 到 `blog/source/_posts/`，通过 GitHub Contents API 产生真实 commit。 |
| POST | `/api/owner/friends` | `owner_friend_publish.go` | 生成友链数据变更分支并创建 Pull Request，检测重复 URL，避免直接写入受保护的 `master`。 |
| POST | `/api/owner/moments` | `owner_moment_publish.go` | 写入碎语到 `main/src/data/moments.js`，校验年份、日期、分类和内容，按日期插入并返回 commit 信息。 |
| POST | `/api/owner/gallery/images` | `owner_gallery_publish.go` | 写入公开图片 URL 到 `main/src/data/galleryAlbums.js`，必要时创建相册并避免重复图片。 |

### Obsidian / Claudian 发布接口

`POST /api/integrations/obsidian/publish` 接收 Markdown，通过独立的 `OBSIDIAN_PUBLISH_TOKEN` Bearer 令牌鉴权，并复用 GitHub Contents 发布链写入 `blog/source/_posts/`。请求可设置 `dryRun: true`，只验证并返回生成结果，不产生 commit。

Claudian 的 MCP 桥与配置步骤见 `integrations/claudian-blog-mcp/README.md`。真实 GitHub token 与发布 token 均只保存在服务器或本机环境变量中。

常用站长发布请求：

```http
POST /api/owner/moments
{
  "year": "2026",
  "date": "6.8",
  "type": "心事",
  "content": "一滴泪真正的重量取决于它落在谁的心上"
}
```

`/api/owner/moments` 也兼容 `category` 字段作为 `type` 的 fallback。发布成功后，GitHub Actions 会按仓库部署流程更新主站。

### 留言小纸条（`/api/guestbook/`）

自研轻量留言板，复用 `acg_session` 登录态；支持访客与登录用户留言，顶层友链留言必须填写联系邮箱，站长（`is_owner`）可删/隐藏。

建表：启动时自动创建 `guestbook_messages`（见 `deploy/guestbook.sql`）。

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/guestbook/messages?page=1&pageSize=20` | 列表；普通用户仅 `visible`，管理员含 `hidden` |
| POST | `/api/guestbook/messages` | 发布；普通留言访客提交 `{ nickname, content }`、登录用户提交 `{ content }`，顶层友链留言提交 `{ nickname, contactEmail, content }` |
| DELETE | `/api/guestbook/messages/:id` | 软删除（`deleted`），仅 admin |
| PATCH | `/api/guestbook/messages/:id/status` 或 `/:id` | `{ "status": "hidden" }`，仅 admin |

限流：访客 3/小时、10/天；登录 10/小时、30/天；60 秒内同内容防重复。429 返回 `RATE_LIMITED`。

IP：仅存 `ip_hash`、`ip_masked`；公开展示 `ipRegion`（依赖 `ip-api.com`，失败时为「未知地区」）。

前端页面：`main/` 路由 `/guestbook`，首页 Story「LEAVE A MESSAGE」入口。

Copy `.env.example` → `/opt/acg-api/.env` and set `BANGUMI_ACCESS_TOKEN` plus the credentials needed by enabled backend features. The Bangumi token is read only by the Go service and is never returned by the public API.

For owner asset uploads to Tencent COS, also set:

- `TENCENT_COS_SECRET_ID`
- `TENCENT_COS_SECRET_KEY`
- `TENCENT_COS_BUCKET`
- `TENCENT_COS_REGION`
- optional `TENCENT_COS_BASE_URL`

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

## Follow-Up Plan

- 服务器数据和状态监测：在站长控制台中展示服务健康、资源使用、同步状态和关键数据趋势。
- 邮箱绑定与发送：补充账号邮箱绑定、验证和通知发送能力。
- 设计艺术字主页：前端继续探索更有辨识度的首页标题与艺术字主视觉方向。
