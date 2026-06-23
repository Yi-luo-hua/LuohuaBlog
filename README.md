# Taozhiyy Monorepo / 桃之夭夭 Monorepo

[中文说明](./README.zh-CN.md) | English

This is the monorepo for my personal website `Taozhiyy / 桃之夭夭`, including the main site, build-log subsite, Hexo blog, shared AI assistant scripts, and backend API.

## Project Structure

- `main/`: Main frontend site, built with React, Vite, Tailwind CSS, and GSAP.
- `build/`: Build-log subsite for recording how this website is built and iterated.
- `blog/`: Hexo + Butterfly blog.
- `acg-api/`: Go backend API, including guestbook, mail notifications, AI assistant, AI image generation, Bili Hub cache sync, and related features.
- `shared/`: Shared scripts and styles used by multiple sites, such as the floating AI assistant.
- `deploy/`: Deployment-related scripts.
- `.github/workflows/`: GitHub Actions deployment configuration.

## Homepage Reference And Learning Notice

The homepage was initially created while studying and learning from the following project:

[adrianhajdin/award-winning-website](https://github.com/adrianhajdin/award-winning-website)

I fully respect the original author's work and sincerely appreciate the educational value of that project. It helped me learn modern frontend animation, scroll-based interaction, video-driven visual composition, and immersive homepage structure.

To be clear: **this project is not a completely original work at its current stage**. It is still a personal learning project that started from studying the original author's project and has been gradually modified, rebuilt, and improved with my own original ideas.

I am continuously moving this project toward a more original implementation while respecting the original author's effort. No matter how far this originality process goes in the future, even if it eventually becomes almost entirely my own implementation, I will not forget the help that open-source projects and high-quality tutorials have provided.

This repository is **not affiliated with, endorsed by, authorized by, or commercially connected to** the original author, the tutorial project, or Zentry. The reference is stated openly here for transparency and to avoid giving visitors the false impression that this homepage was created without any reference.

## Original And Customized Parts In This Project

I have made many original and site-specific changes around my own personal website identity, including but not limited to:

- A custom hero wallpaper selector based on a compass/avatar badge interaction.
- Personal site identity, wording, and content structure for `桃之夭夭`.
- A visual postcard-style scrolling About section.
- A gallery layout and archive-book page-flipping interaction for the Features section.
- Custom routing and integrations for Blog, Build Log, Bili Hub, AI assistant, guestbook, friends, gallery, and the `/moments` Moments page.
- Backend APIs for comments, mail notifications, AI context, AI image generation, Bili data caching, owner-only publishing, friend links, gallery images, and Moments updates.
- Engineering configuration for my own domain, UCloud server, and GitHub Actions deployment.

Across these original/customized parts, the product direction, feature planning, interaction model, content structure, and visual taste are led by me. **Vibe Coding / AI coding tools are implementation assistants** for coding, debugging, organizing details, and iteration; they do not replace my authorship over the requirements, design decisions, and final selection. In that sense, the customized product design and ongoing evolution of this site are my original work, with AI-assisted implementation.

These original/customized parts were mainly completed through **vibecoding**: I defined requirements, made design decisions, evaluated results, and iterated continuously, while AI coding tools helped implement code and visual details.

The parts that were created, designed, organized, or iterated by me through vibecoding may be freely referenced, studied, and used, as long as this notice is respected.

However, for anything that may involve the original referenced project's design, structure, interaction ideas, or code origin, please do not treat this repository as the source of permission. Please go to the original author's project to review its own documentation, license, and usage boundaries.

## Subpages And Backend Notes

### `blog/` Blog Page

The `blog/` subpage is built with Hexo + Butterfly.

For the detailed blog source code, theme configuration, deployment process, and fuller documentation, please refer to my independent blog repository:

[bistutzyy/bistutzyy.github.io](https://github.com/bistutzyy/bistutzyy.github.io)

The original theme author/project used by this blog is:

[Butterfly](https://butterfly.js.org/)

If you have questions about Hexo, Butterfly deployment, theme configuration, attribution, or licensing boundaries, please refer to the official Butterfly documentation and the original author's project.

### `build/` Build Log Page

The `build/` page is a build-log subsite created with the help of **vibecoding**. It records the process of building this website, including domain setup, server configuration, deployment workflow, and feature iteration.

This page is an original/customized page created during my personal learning and practice process. You are welcome to freely reference, study, and use it.

Recent build-log updates also record the migrated `/moments` page, the owner-console publishing flow for short Moments, the Leyili Garden friend-link correction, the homepage/page-level double-scroll fix, the AI fixed-answer sync from the owner console into the public site assistant, UTF-8-safe mail notifications, friend-page contact-email collection, threaded friend replies, owner-only email visibility, data-center server status monitoring, and AI image generation saved to Tencent COS.

### `main/` Main Site Notes

The main site now includes a first-class `/moments` page named `碎语`. It is reachable from the top navigation and renders short notes from `main/src/data/moments.js` with varied holographic card modules such as postcard, ticket, watercolor, poem, journal, and ribbon.

The latest cleanup also corrected the friend link for `https://930309.xyz/` to `Leyili 花园`, using `https://photo.930309.xyz/lcj.svg` and the description `小小后花园~~~`. The separate `090909.top` friend link remains `他说`.

The homepage double-scroll issue was fixed by tightening Hero and site-layout overflow behavior, with regression tests covering the expected layout classes.

The owner-console AI answer area now saves fixed answers into the backend instead of keeping them only in local React state. `GET /api/owner/status` returns the saved answers for review, and `/api/chat` checks the fixed-answer table before calling DeepSeek, so matching public-site questions can receive the maintained reply immediately.

The Data Center page (`/ai-traffic`) now combines AI traffic with a live server status panel. `ServerInfoPanel` refreshes `GET /api/server/info` every 10 seconds and shows safe telemetry such as status, cloud vendor/region, CPU usage, memory usage, uptime, OS/runtime, CPU cores, goroutine count, and server time. The endpoint intentionally avoids exposing sensitive server details such as real IPs, hostnames, disk paths, process lists, or environment variables.

The floating AI assistant also has an image-generation mode for logged-in users. It calls the backend `/api/ai/image` route, uses Agnes AI `agnes-image-2.1-flash`, stores the generated image in Tencent COS, records the final COS URL, prompt, and creation time for `/ai-gallery`, and shows the result in a centered translucent holographic card with local-save and COS-link copy actions.

### `acg-api/` Backend And API

The backend and API calling logic were mainly completed with the help of **vibecoding**, including guestbook, mail notifications, AI assistant context, AI image generation, Bili Hub data cache sync, and related functions.

Concretely, `acg-api` is the Go service layer behind the site's `/api` routes. It is a standard `net/http` service bootstrapped from `acg-api/main.go`: it loads `/opt/acg-api/.env` and local `.env`, opens SQLite at `ACG_DATA_DIR/acg.db`, runs database migrations, reserves the owner account, starts Bilibili/radar/wallpaper sync loops, and is normally exposed by Nginx as `/api`.

Backend controller map:

| Controller / file | Main routes | Access | Responsibility |
| --- | --- | --- | --- |
| `main.go` public controllers | `GET /api/v1/health`, `GET /api/v1/bangumi/list`, `GET /api/v1/radar/feed`, `GET /api/v1/wallpapers/draw`, `GET /api/v1/acg/image/:name` | Public | Health check, Bili bangumi cache, radar feed, wallpaper draw pool, and cached cover/image serving. |
| `main.go` protected sync trigger | `POST /api/v1/sync/trigger` | Deploy token or owner session | Manual sync trigger. Requests must include `X-Sync-Trigger-Token` matching `SYNC_TRIGGER_TOKEN` or an authenticated owner session. |
| `main.go` legacy guestbook | `GET/POST /api/v1/guestbook` | Public | Older simple guestbook API using `name` and `content`. Kept for compatibility with earlier frontend code. |
| `auth.go` | `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/verify-security`, `POST /api/auth/logout`, `PATCH /api/auth/profile`, `GET /api/auth/me` | Public/login/owner challenge | Email registration, login, session cookie management, display-name updates, and owner second-step verification. |
| `chat.go`, `chat_quota.go`, `chat_stats.go`, `deepseek_client.go`, `ai_fixed_answers.go` | `GET/POST /api/chat`, `GET /api/chat/stats` | Public/login/owner quota tiers | AI assistant quota status, fixed-answer lookup, chat requests, DeepSeek proxying, hourly/daily usage statistics, guest/user/owner quota handling. |
| `ai_image.go`, `ai_image_gallery.go` | `GET/POST /api/ai/image`, `GET /api/ai/image/gallery` | Login/owner quota tiers for generation; public gallery feed | Image-generation quota status, Agnes AI image generation, provider-image download, Tencent COS upload, generation-history recording, and a public generated-image plaza feed with prompt, image URL, author label, size, and creation time. |
| `server_info.go` | `GET /api/server/info` | Public safe telemetry | Non-sensitive server status for the Data Center page, including online status, cloud vendor/region labels, CPU usage, memory usage, uptime, runtime metadata, CPU cores, goroutine count, and server time; it intentionally does not expose IPs, hostnames, disk paths, process lists, or environment variables. |
| `guestbook_messages.go`, `guestbook_user.go`, `guestbook_ip.go`, `mail_notifier.go` | `GET/POST /api/guestbook/messages`, `PATCH/DELETE /api/guestbook/messages/:id`, `PATCH /api/guestbook/messages/:id/status` | Public for visible messages and posting; owner/admin for moderation | Current guestbook and friend-page message controller, including channels, threaded replies, visitor/login users, required friend-page contact email, UTF-8 mail notifications, rate limits, duplicate checks, IP masking, and soft moderation. |
| `owner_controller.go` | `GET /api/owner/status`, `GET /api/owner/emails`, `GET/POST /api/owner/drafts`, `POST /api/owner/ai/fixed-answers`, `PATCH /api/owner/notifications/:id/read`, `POST /api/owner/uploads`, `GET /api/owner/uploads/:name`, `POST /api/owner/assets` | Owner only | Owner console status, registered-user list, unread message inbox, owner-only email directory, AI fixed-answer storage, draft storage, local temporary image uploads, and COS asset uploads. |
| `owner_publish.go` | `POST /api/owner/publish` | Owner only + GitHub token | Publishes Markdown through the GitHub Contents API into `blog/source/_posts/`, merges front matter, handles filename conflicts, and returns commit information. |
| `owner_friend_publish.go` | `POST /api/owner/friends` | Owner only + GitHub token | Adds a friend link to `main/src/data/friendCards.js`, with duplicate URL detection so an existing link is not written twice. |
| `owner_moment_publish.go` | `POST /api/owner/moments` | Owner only + GitHub token | Adds a short Moment to `main/src/data/moments.js`, validates year/date/type/content, assigns the next visual card style, inserts by date, and returns commit information. |
| `owner_gallery_publish.go` | `POST /api/owner/gallery/images` | Owner only + GitHub token | Adds a public image URL to `main/src/data/galleryAlbums.js`, creates a new album when needed, and avoids duplicate image entries. |
| `owner_cos.go` | Used by `POST /api/owner/assets` and `POST /api/ai/image` | Owner only or server-side flow + COS credentials | Uploads article/gallery/generated images to Tencent COS using server-side credentials and returns a public URL/object key. |

Important request shapes:

| Route | Body/query | Notes |
| --- | --- | --- |
| `POST /api/auth/register` | `{ "email": "...", "password": "..." }` | Public users only; the owner email is reserved. |
| `POST /api/auth/login` | `{ "email": "...", "password": "..." }` | Owner login returns a `challengeToken` and requires `/api/auth/verify-security`. |
| `POST /api/auth/verify-security` | `{ "challengeToken": "...", "answer": "..." }` | Creates an owner session with unlimited AI quota after the private answer matches. |
| `GET /api/guestbook/messages?page=1&pageSize=20&channel=guestbook` | `channel` is `guestbook` or `friends` | Public users see visible messages; owner/admin can see hidden messages. |
| `POST /api/guestbook/messages` | `{ "nickname": "...", "contactEmail": "...", "content": "...", "parentId": 0, "channel": "guestbook" }` | Normal guestbook messages can be posted with `nickname` + `content` when not logged in, or just `content` when logged in. Top-level `friends` messages must include `nickname` and `contactEmail`; public responses never expose `contactEmail`. Replies ignore submitted `contactEmail` and notify the parent contact/account email when available. |
| `PATCH /api/guestbook/messages/:id` | `{ "status": "visible" \| "hidden" \| "deleted" }` | Owner/admin moderation only. |
| `GET /api/owner/emails` | No body | Owner-only directory returning registered user emails and private guestbook contact emails. |
| `GET /api/ai/image` | No body | Returns image quota, `imageEnabled`, `canGenerate`, selected model, and `promptExtend: false`. |
| `POST /api/ai/image` | `{ "prompt": "...", "size": "1024*1024" }` | Logged-in users only; normal users are limited to 3 images/day, owner is unlimited. Supported sizes are `1024*1024`, `1280*720`, and `720*1280`; the returned `image.url` is the final Tencent COS URL. |
| `GET /api/ai/image/gallery?limit=60&before=...` | Optional cursor query | Public generated-image plaza feed. Returns items with `prompt`, `imageUrl`, `size`, `createdAt`, and anonymous-safe `author` display text. |
| `GET /api/server/info` | No body | Returns non-sensitive live telemetry for `/ai-traffic`, refreshed by the frontend every 10 seconds. |
| `POST /api/owner/uploads` | `multipart/form-data` with `file` | Stores a temporary local image under `ACG_DATA_DIR/owner-uploads`, max 8 MiB. |
| `POST /api/owner/assets` | `multipart/form-data` with `file`, `kind` as `gallery` or `article`, optional `album` | Uploads to Tencent COS. Gallery uploads require an album. |
| `POST /api/owner/publish` | `{ "draftId": 1, "title": "...", "body": "...", "coverUrl": "..." }` | Writes a real GitHub commit through the configured token. |
| `POST /api/owner/friends` | `{ "name": "...", "desc": "...", "url": "...", "avatar": "..." }` | `url` and `avatar` must be public `http`/`https` URLs. |
| `POST /api/owner/moments` | `{ "year": "2026", "date": "6.8", "type": "...", "content": "..." }` | Writes a short Moment to `main/src/data/moments.js`; `category` is also accepted as a fallback for `type`. |
| `POST /api/owner/gallery/images` | `{ "albumId": "...", "albumTitle": "...", "imageUrl": "..." }` | `imageUrl` must be a public `http`/`https` URL. |
| `POST /api/owner/ai/fixed-answers` | `{ "question": "...", "answer": "..." }` | Saves or updates an owner-only fixed answer. Public `/api/chat` normalizes the incoming question and returns the fixed answer before falling back to DeepSeek. |

Clone/deploy environment checklist:

- Runtime: `ACG_API_ADDR` defaults to `:8787`; `ACG_DATA_DIR` defaults to `./data`.
- Owner login: set `AUTH_OWNER_PASSWORD` and `AUTH_OWNER_SECURITY_ANSWER`; optionally tune `AUTH_SESSION_DAYS` and `AUTH_COOKIE_SECURE`.
- Important source-level identity note: `owner.go` currently reserves the owner email and displays the security-question text for this site's deployment. Anyone reusing the backend should replace those constants or move them to environment variables for their own deployment.
- AI assistant: set `DEEPSEEK_API_KEY`; optionally set `DEEPSEEK_BASE_URL` and `DEEPSEEK_MODEL`.
- AI image generation: set `AGNES_API_KEY`; optionally set `AGNES_BASE_URL` (default `https://apihub.agnes-ai.com`) and `AGNES_IMAGE_MODEL` or `AI_IMAGE_MODEL` (default `agnes-image-2.1-flash`). If `AGNES_API_KEY` is absent, the backend still falls back to the legacy DashScope variables `DASHSCOPE_API_KEY`, `DASHSCOPE_BASE_URL`, `AI_IMAGE_MODEL`, and `ALIYUN_BAILIAN_API_KEY`.
- Mail notifications: set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM_NAME`, and `MAIL_NOTIFY_TO`. `SMTP_PASS` should be a mail-provider app password or authorization code, never an account login password.
- GitHub owner publishing: set `OWNER_PUBLISH_GITHUB_TOKEN`; optionally set `OWNER_PUBLISH_GITHUB_API_BASE`, `OWNER_PUBLISH_GITHUB_OWNER`, `OWNER_PUBLISH_GITHUB_REPO`, and `OWNER_PUBLISH_GITHUB_BRANCH`. The token must have permission to write repository contents.
- Tencent COS upload: set `TENCENT_COS_SECRET_ID`, `TENCENT_COS_SECRET_KEY`, `TENCENT_COS_BUCKET`, `TENCENT_COS_REGION`, and optionally `TENCENT_COS_BASE_URL`. Legacy `COS_SECRET_ID`, `COS_SECRET_KEY`, `COS_BUCKET`, `COS_REGION`, and `COS_BASE_URL` are also supported as fallbacks.
- Bili sync: `BILIBILI_UID` can override the default UID; the radar creator list is defined in `acg-api/config.go`.
- Frontend API base: production builds should point `VITE_API_BASE` to the deployed site origin, such as `https://taozhiyy.top`.

Security boundary: this repository may expose route names, controller structure, environment variable names, owner-account source constants, and deployment workflow shape, but it is not intended to include my owner login password, verification answer, GitHub token, COS secret, AI key, server credentials, runtime SQLite database, or private `.env`. Backend upload/publish features are safe to expose only when the real credentials stay on the server or in GitHub Actions secrets. Anyone cloning this project must provide their own credentials, verification information, database, deployment host, and external service configuration.

If you want to reference or reuse the backend logic, please read, verify, and test it first to make sure it fits your own use case.

Environment variables, secrets, server addresses, database settings, and external service configurations must be prepared and configured by yourself. This repository does not provide private environment variables that can be reused directly.

If you find any problem while reading, using, or deploying this project, or if you have any suggestions, you are welcome to contact me.

## Follow-Up Plan

- Server history and alerts: keep trend records for CPU, memory, error rate, and sync duration on top of the current live status panel.
- Generated-image showcase page: turn generated COS images into a browsable, reusable, and manageable site gallery.
- Artistic lettering homepage: explore a more recognizable homepage title/typographic art direction for the main visual identity.

## Non-Commercial Position

This project is used only for **personal learning, technical exploration, personal website deployment, and non-commercial technical communication**.

I will not sell this homepage as a template, package it as a commercial product, or use it for commercial profit. If any part of this project is considered inappropriate, too close to the referenced work, or unsuitable for public display, I am willing to keep revising, replacing, or removing it.

## Thanks

Thanks to the original author and the open-source/frontend learning community for providing high-quality learning resources. The growth of this project would not be possible without the inspiration brought by public projects, tutorials, and tools.
