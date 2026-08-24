# LuohuaBlog

中文说明 | [English](./README.md)

我的个人网站的 monorepo —— 主站、博客，以及支撑它们的 Go 后端。已部署在 Azure 虚拟机上，见下方[部署](#部署)一节。

## 目录结构

| 路径 | 内容 |
| --- | --- |
| `main/` | 主站。React 18 + Vite + Tailwind + GSAP。 |
| `blog/` | Hexo + Butterfly 博客，挂在 `/blog/`。 |
| `acg-api/` | Go + SQLite 后端，Nginx 反代为 `/api`。 |
| `integrations/` | Obsidian → GitHub 发布桥（MCP）。 |
| `deploy/` | systemd 单元、Nginx 片段与服务器安装脚本。 |
| `tools/` | Python 健康检查与仓库守卫测试。 |

## 本地运行

```bash
cd acg-api && go run .
```

```bash
cd main && npm install && npm run dev
```

前端把 `/api` 代理到 `127.0.0.1:8787`，需要真实数据时要先起后端。一键脚本、日志位置和 `502` 排查见 [docs/DEBUGGING.md](./docs/DEBUGGING.md)。

## 部署

站点跑在 Azure for Students 的虚拟机上（East Asia），通过公网 IP 以明文 HTTP
提供服务。目前还没有域名和 TLS 证书，因此 Nginx 对 `/api/` 只放行 `GET`、`HEAD`
和 `OPTIONS`，所有写请求一律返回 `403`。这是有意为之：没有 HTTPS 时，一次登录
POST 会把密码明文送上公网。所以注册、登录、留言、AI 请求和站长发布在拿到域名和
证书之前都是关着的。

部署方式是手工构建后上传，不是定时拉取，也没有启用自动部署。主机信息、目录结构、
服务名以及拿到域名后的迁移顺序，都在
[docs/AZURE_DEPLOYMENT_HANDOFF.md](./docs/AZURE_DEPLOYMENT_HANDOFF.md)。

## 后端接口

`acg-api` 是从 `acg-api/main.go` 启动的标准 `net/http` 服务：加载 `/opt/acg-api/.env`，在 `ACG_DATA_DIR/acg.db` 打开 SQLite，执行迁移，保留站长账号，并启动后台同步循环。

| 分区 | 路由 |
| --- | --- |
| 公开数据 | `GET /api/v1/health`、`/api/v1/bangumi/list`、`/api/v1/wallpapers/draw`、`/api/v1/github/commits`、`/api/server/info` |
| 留言板 | `GET/POST /api/guestbook/messages`、`PATCH/DELETE /api/guestbook/messages/:id` |
| 认证 | `POST /api/auth/register`、`/login`、`/verify-security`、`/logout`；`GET /api/auth/me` |
| AI | `GET/POST /api/chat`、`/api/ai/image`；`GET /api/chat/stats`、`/api/ai/image/gallery` |
| 仅站长 | `GET /api/owner/status`，`POST /api/owner/publish`、`/friends`、`/moments`、`/gallery/images`、`/assets` |

仅站长的路由通过 GitHub Contents API 提交，因此需要一个对本仓库有写权限的 token。

## 配置

所有密钥只存在于服务器上，不进仓库。复制 `acg-api/.env.example` 后填写：

- **运行时** —— `ACG_API_ADDR`（默认 `:8787`）、`ACG_DATA_DIR`（默认 `./data`）
- **站长登录** —— `AUTH_OWNER_PASSWORD`、`AUTH_OWNER_SECURITY_ANSWER`
- **AI** —— `DEEPSEEK_API_KEY`、`AGNES_API_KEY`
- **邮件** —— `SMTP_HOST`、`SMTP_PORT`、`SMTP_USER`、`SMTP_PASS`、`MAIL_NOTIFY_TO`（用授权码，别用账号密码）
- **发布** —— `OWNER_PUBLISH_GITHUB_TOKEN`
- **对象存储** —— `TENCENT_COS_SECRET_ID`、`TENCENT_COS_SECRET_KEY`、`TENCENT_COS_BUCKET`、`TENCENT_COS_REGION`
- **数据源** —— `BANGUMI_ACCESS_TOKEN`、`GITHUB_ACTIVITY_LOGIN`，可选 `GITHUB_ACTIVITY_TOKEN`
- **邮件里的链接** —— `SITE_PUBLIC_ORIGIN`，通知邮件回链使用的源

前端自身的地址由构建期变量决定，统一在 `main/src/lib/siteIdentity.js` 里解析：

- `VITE_API_BASE` —— 浏览器请求 `/api` 的源；同源部署留空即可
- `VITE_SITE_HOST` —— 站点公开域名，如 `yourdomain.com`（默认 `example.com`）
- `VITE_SITE_APP_HOST` —— 站长 PWA 控制台的域名，默认为 `app.<VITE_SITE_HOST>`
- `VITE_SITE_PROTOCOL` —— 仅用于覆盖协议；默认按主机推断：裸 IP 和 `localhost`
  用 `http`，域名用 `https`，所以用 IP 部署时不需要再手工改构建产物

`blog/_config.yml` 里的 `url:` 影响 sitemap 和 RSS，改域名时要和 `VITE_SITE_HOST`
一起改。

本仓库有意公开路由名、控制器结构和环境变量**名称**，但绝不包含站长密码、验证答案、各类 token、COS 密钥、AI 密钥、服务器凭据或运行时数据库。克隆者需自备。

## 来源说明

首页最初参照 **[adrianhajdin/award-winning-website](https://github.com/adrianhajdin/award-winning-website)** 这个教程项目学习滚动动画与视频驱动的版式；整站则以 **[bistutzyy/taozhiyy](https://github.com/bistutzyy/taozhiyy)** 为模板搭建起来，此后逐步改写为我自己的设计、内容与后端。涉及被参照项目的授权问题，请以那些仓库自身的说明为准，不要把本仓库当作授权来源。

博客使用 Hexo 的 **[Butterfly](https://butterfly.js.org/)** 主题。

## 非商业声明

仅用于个人学习、个人网站部署与非商业技术交流。不会作为模板售卖，也不会包装成商业产品。
