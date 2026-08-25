# LuohuaBlog

[中文说明](./README.zh-CN.md) | English

The monorepo behind my personal site — main site, blog, and the Go backend that serves them. Live on an Azure VM; see [Deployment](#deployment).

## Layout

| Path | What it is |
| --- | --- |
| `main/` | Main site. React 18 + Vite + Tailwind + GSAP. |
| `blog/` | Hexo + Butterfly blog, served at `/blog/`. |
| `acg-api/` | Go + SQLite backend. Nginx exposes it as `/api`. |
| `integrations/` | Obsidian → GitHub publishing bridge (MCP). |
| `deploy/` | systemd units, Nginx snippets, and server install scripts. |
| `tools/` | Python health-check and repo guard tests. |

## Running locally

```bash
cd acg-api && go run .
```

```bash
cd main && npm install && npm run dev
```

The frontend proxies `/api` to `127.0.0.1:8787`, so start the backend first if you need live data. See [docs/DEBUGGING.md](./docs/DEBUGGING.md) for the one-command script, logs, and `502` troubleshooting.

## Deployment

The site runs on an Azure for Students VM in East Asia at
[https://yiluohua.top](https://yiluohua.top). The blog is served from
`/blog/`, while the owner PWA host is `https://app.yiluohua.top`. Nginx redirects
plain HTTP and public-IP requests to HTTPS, and Certbot renews the Let's Encrypt
certificate automatically. API write methods are available over TLS; features
that require owner, AI, SMTP, GitHub, or storage credentials still remain
disabled until those secrets are configured on the server.

Deployment is a manual build-and-upload, not a timer — there is no automatic
pull. [docs/AZURE_DEPLOYMENT_HANDOFF.md](./docs/AZURE_DEPLOYMENT_HANDOFF.md)
carries the host details, directory layout, service names, TLS configuration,
and recovery procedure.

## Backend surface

`acg-api` is a plain `net/http` service bootstrapped from `acg-api/main.go`. It loads `/opt/acg-api/.env`, opens SQLite at `ACG_DATA_DIR/acg.db`, runs migrations, reserves the owner account, and starts background sync loops.

| Area | Routes |
| --- | --- |
| Public data | `GET /api/v1/health`, `/api/v1/bangumi/list`, `/api/v1/wallpapers/draw`, `/api/v1/github/commits`, `/api/server/info` |
| Guestbook | `GET/POST /api/guestbook/messages`, `PATCH/DELETE /api/guestbook/messages/:id` |
| Auth | `POST /api/auth/register`, `/login`, `/verify-security`, `/logout`; `GET /api/auth/me` |
| AI | `GET/POST /api/chat`, `/api/ai/image`; `GET /api/chat/stats`, `/api/ai/image/gallery` |
| Owner only | `GET /api/owner/status`, `POST /api/owner/publish`, `/friends`, `/moments`, `/gallery/images`, `/assets` |

Owner-only routes commit through the GitHub Contents API, so they need a token with write access to this repository.

## Configuration

Every secret lives on the server, never in this repository. Copy `acg-api/.env.example` and fill it in:

- **Runtime** — `ACG_API_ADDR` (default `:8787`), `ACG_DATA_DIR` (default `./data`)
- **Owner login** — `AUTH_OWNER_PASSWORD`, `AUTH_OWNER_SECURITY_ANSWER`
- **AI** — `DEEPSEEK_API_KEY`, `AGNES_API_KEY`
- **Mail** — `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_NOTIFY_TO` (use an app password, never the account password)
- **Publishing** — `OWNER_PUBLISH_GITHUB_TOKEN`
- **Storage** — `TENCENT_COS_SECRET_ID`, `TENCENT_COS_SECRET_KEY`, `TENCENT_COS_BUCKET`, `TENCENT_COS_REGION`
- **Feeds** — `BANGUMI_USERNAME`, `GITHUB_ACTIVITY_LOGIN`; optional `BANGUMI_ACCESS_TOKEN` (only for private collections) and `GITHUB_ACTIVITY_TOKEN`
- **Links in mail** — `SITE_PUBLIC_ORIGIN`, the origin notification mail links back to

The frontend's own address comes from build-time variables, resolved in
`main/src/lib/siteIdentity.js`:

- `VITE_API_BASE` — origin the browser calls for `/api`; leave empty for same-origin
- `VITE_SITE_HOST` — public host, e.g. `yourdomain.com` (defaults to `example.com`)
- `VITE_SITE_APP_HOST` — host that gates the owner PWA console, defaults to `app.<VITE_SITE_HOST>`
- `VITE_SITE_PROTOCOL` — only to override the scheme; by default a bare IP or
  `localhost` resolves to `http` and a domain name to `https`, so an IP-hosted
  build needs no post-build patching

`blog/_config.yml` carries its own `url:` for the sitemap and RSS feed; change it
alongside `VITE_SITE_HOST`.

This repository intentionally exposes route names, controller structure, and environment variable *names*. It never contains the owner password, verification answer, tokens, COS keys, AI keys, server credentials, or the runtime database. Anyone cloning it must supply their own.

## Credits

The homepage started from **[adrianhajdin/award-winning-website](https://github.com/adrianhajdin/award-winning-website)**, a tutorial project I studied while learning scroll-driven animation and video-led layout. The site was then built up from **[bistutzyy/taozhiyy](https://github.com/bistutzyy/taozhiyy)** as a template, and has since been rewritten toward my own design, content, and backend. For licensing questions about the referenced work, go to those repositories rather than treating this one as the source of permission.

The blog runs on the **[Butterfly](https://butterfly.js.org/)** theme for Hexo.

## Non-commercial

Personal learning, personal deployment, and non-commercial technical exchange only. I do not sell this as a template or package it as a product.
