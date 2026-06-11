# Taozhiyy Monorepo / 桃之夭夭 Monorepo

中文说明 | [English](./README.md)

这是我的个人网站 `桃之夭夭` 的 monorepo，包含主站、成长博客子站、Hexo 博客、共享 AI 助手脚本和后端 API。

## 项目结构

- `main/`: 主站前端，基于 React、Vite、Tailwind CSS 和 GSAP。
- `build/`: 成长博客子站，用于记录本站从搭建到迭代的过程。
- `blog/`: Hexo + Butterfly 博客。
- `acg-api/`: Go 后端 API，包含留言板、邮件通知、AI 助手、AI 生图、Bili Hub 缓存同步等功能。
- `shared/`: 多个站点共用的脚本与样式，例如右下角 AI 助手。
- `deploy/`: 部署相关脚本。
- `.github/workflows/`: GitHub Actions 自动部署配置。

## 首页参考与学习声明

本项目首页最初是在学习和参考以下项目的过程中搭建起来的：

[adrianhajdin/award-winning-website](https://github.com/adrianhajdin/award-winning-website)

我非常尊重原作者的劳动成果，也感谢该项目对我学习现代前端动画、滚动交互、视频视觉布局和沉浸式页面结构带来的帮助。

需要明确说明的是：**当前项目并不是完全原创作品**。它仍然是在原作者项目的启发与学习基础上，逐步进行修改、重构和原创化改进的个人学习项目。

我一直秉持尊重原作者劳动成果的理念推进项目原创化。无论这个项目未来原创化推进到多少完成度，哪怕有一天达到接近 100% 的个人实现，我也不会忘记这些开源项目和优秀教程曾经对我的帮助。

本仓库与原作者、原教程项目或 Zentry 没有任何从属、授权、商业合作或官方关联关系。本说明公开写明参考来源，是为了保持透明，也避免让访问者误以为本项目完全脱离参考来源而独立产生。

## 本项目中的原创与定制部分

目前我已经围绕个人网站定位做了大量原创化和定制化改造，包括但不限于：

- 基于头像徽章与指南针交互的 Hero 壁纸选择器。
- `桃之夭夭` 个人站点身份、文案与内容组织。
- About 区域的视觉明信片式滚动展示。
- Features 区域的展厅布局与档案书翻页交互。
- Blog、Build Log、Bili Hub、AI 助手、留言板、友链、相册和 `/moments` 碎语页面等站内功能路由与集成。
- 留言、邮件通知、AI 上下文、AI 生图、Bili 数据缓存、站长发布、友链、相册图片和碎语更新等后端 API。
- 适配个人域名、UCloud 服务器、GitHub Actions 自动部署的工程配置。

在这些原创/定制部分里，整体产品方向、功能规划、交互逻辑、内容组织和审美取舍由我主导。**Vibe Coding / AI 编程工具是实现辅助**：它们帮助我写代码、调试、整理细节和迭代版本，但不替代我对需求、设计判断和最终效果的主导。因此，本站的定制化产品设计和持续迭代成果属于我的原创设计与个人实践。

这些原创化和定制化部分主要借助 **vibecoding** 的方式完成：我提出需求、判断方向、筛选效果并持续迭代，AI 编程工具辅助实现代码与视觉细节。

由我本人完成、设计、组织或通过 vibecoding 推进出的原创部分，可以在尊重本说明的前提下自由参考、学习和使用。

但如果某些内容涉及原参考项目的设计、结构、交互思路或代码来源，请不要直接从本仓库视为授权来源；请自行前往原作者项目查阅其说明、许可和使用边界。

## 子页面与后端说明

### `blog/` 博客页面

`blog/` 子页面是基于 Hexo + Butterfly 搭建的博客页面。

该部分的具体博客源码、主题配置、部署方式和更完整说明，请前往我的独立博客仓库查看：

[bistutzyy/bistutzyy.github.io](https://github.com/bistutzyy/bistutzyy.github.io)

该博客使用的主题原作者与项目为：

[Butterfly](https://butterfly.js.org/)

如果你有 Hexo、Butterfly 主题部署、主题配置、引用来源标注或许可边界相关问题，请自行前往 Butterfly 官方文档与原作者项目查阅。

### `build/` 成长博客页面

`build/` 页面是我借助 **vibecoding** 搭建出的成长博客子站，用于记录本站从域名、服务器、部署流程到功能迭代的搭建过程。

该页面属于我个人学习和实践过程中搭建的原创/定制页面，欢迎自由参考、学习和使用。

最近的成长记录也补充了 `/moments` 碎语页面迁移、站长控制台碎语发布链路、Leyili 花园友链修正、首页和其他页面的双层滚动修复、AI 固定答案从站长控制台同步到网站助手的链路、UTF-8 安全邮件通知、友链联系邮箱收集、友链连续回复、站长后台邮箱可见能力，以及 AI 生图结果保存到腾讯 COS 的链路。

### `main/` 主站说明

主站现在包含一个正式的 `/moments` 页面，页面名称为“碎语”。它可以从顶部导航进入，并从 `main/src/data/moments.js` 读取短内容，使用 postcard、ticket、watercolor、poem、journal、ribbon 等多种全息卡片模块展示。

最近也修正了 `https://930309.xyz/` 的友链信息：名称为 `Leyili 花园`，图标为 `https://photo.930309.xyz/lcj.svg`，描述为 `小小后花园~~~`。独立的 `090909.top` 友链仍然保留为“他说”。

首页双层滚动条问题已经通过收紧 Hero 与站点布局的 overflow 行为修复，并补充了布局类名相关的回归测试。

站长控制台里的 AI 固定答案区现在不再只保存在本地 React 状态中，而是写入后端固定问答库。`GET /api/owner/status` 会把已保存答案返回给控制台查看，`/api/chat` 在调用 DeepSeek 前会先匹配固定答案，因此网站右下角 AI 助手遇到相同问题时可以优先返回维护好的回复。

右下角 AI 助手也加入了面向登录用户的生图模式。它会调用后端 `/api/ai/image`，使用阿里云百炼 DashScope 的 `z-image-turbo`，固定关闭提示词改写，把生成图保存到腾讯 COS，并在屏幕中央用透明浅色镭射卡片展示结果，支持保存本地和复制最终 COS 链接。

### `acg-api/` 后端与 API

后端部分以及 API 调用逻辑主要借助 **vibecoding** 完成，包括留言板、邮件通知、AI 助手上下文、AI 生图、Bili Hub 数据缓存同步等功能。

更具体地说，`acg-api` 是本站 `/api` 路由背后的 Go 服务层。它是从 `acg-api/main.go` 启动的标准 `net/http` 服务：启动时会加载 `/opt/acg-api/.env` 和本地 `.env`，在 `ACG_DATA_DIR/acg.db` 打开 SQLite，执行数据库迁移，保留站长账号，启动 Bilibili / radar / 壁纸池同步循环，并通常由 Nginx 反向代理暴露为 `/api`。

后端控制器说明：

| 控制器 / 文件 | 主要路由 | 权限 | 职责 |
| --- | --- | --- | --- |
| `main.go` 公开控制器 | `GET /api/v1/health`, `GET /api/v1/bangumi/list`, `GET /api/v1/radar/feed`, `GET /api/v1/wallpapers/draw`, `GET /api/v1/acg/image/:name` | 公开 | 健康检查、Bili 番剧缓存、radar 动态、壁纸抽取池、缓存封面/图片服务。 |
| `main.go` 受保护同步触发 | `POST /api/v1/sync/trigger` | 部署 token 或站长会话 | 手动同步触发；请求必须携带匹配 `SYNC_TRIGGER_TOKEN` 的 `X-Sync-Trigger-Token`，或使用已认证的站长会话。 |
| `main.go` 旧留言接口 | `GET/POST /api/v1/guestbook` | 公开 | 早期简单留言 API，只包含 `name` 和 `content`，用于兼容旧前端。 |
| `auth.go` | `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/verify-security`, `POST /api/auth/logout`, `PATCH /api/auth/profile`, `GET /api/auth/me` | 公开/登录/站长二次验证 | 邮箱注册、登录、会话 cookie、昵称修改、站长二次验证。 |
| `chat.go`, `chat_quota.go`, `chat_stats.go`, `deepseek_client.go`, `ai_fixed_answers.go` | `GET/POST /api/chat`, `GET /api/chat/stats` | 公开/登录/站长额度 | AI 助手额度查询、固定答案匹配、聊天请求、DeepSeek 转发、小时/日统计、游客/用户/站长额度控制。 |
| `ai_image.go` | `GET/POST /api/ai/image` | 登录/站长额度 | 生图额度状态、DashScope `z-image-turbo` 生图、固定 `promptExtend: false`、临时图下载、腾讯 COS 上传和生成历史记录。 |
| `guestbook_messages.go`, `guestbook_user.go`, `guestbook_ip.go`, `mail_notifier.go` | `GET/POST /api/guestbook/messages`, `PATCH/DELETE /api/guestbook/messages/:id`, `PATCH /api/guestbook/messages/:id/status` | 公开可见留言；站长/管理员可审核 | 当前留言板和朋友页留言控制器，支持分区、连续回复、匿名/登录用户、友链联系邮箱必填、UTF-8 邮件通知、限流、防重复、IP 脱敏和软审核。 |
| `owner_controller.go` | `GET /api/owner/status`, `GET /api/owner/emails`, `GET/POST /api/owner/drafts`, `POST /api/owner/ai/fixed-answers`, `PATCH /api/owner/notifications/:id/read`, `POST /api/owner/uploads`, `GET /api/owner/uploads/:name`, `POST /api/owner/assets` | 仅站长 | 站长控制台状态、注册用户列表、未读留言收件箱、仅站长可见邮箱目录、AI 固定答案保存、草稿保存、本地临时图片上传、COS 资源上传。 |
| `owner_publish.go` | `POST /api/owner/publish` | 站长 + GitHub token | 通过 GitHub Contents API 发布 Markdown 到 `blog/source/_posts/`，合并 front matter，处理文件名冲突，并返回 commit 信息。 |
| `owner_friend_publish.go` | `POST /api/owner/friends` | 站长 + GitHub token | 写入友链到 `main/src/data/friendCards.js`，会检测重复 URL，已有链接不会重复写入。 |
| `owner_moment_publish.go` | `POST /api/owner/moments` | 站长 + GitHub token | 写入碎语到 `main/src/data/moments.js`，校验年份、日期、分类和内容，分配下一组视觉卡片样式，按日期插入，并返回 commit 信息。 |
| `owner_gallery_publish.go` | `POST /api/owner/gallery/images` | 站长 + GitHub token | 写入公开图片 URL 到 `main/src/data/galleryAlbums.js`，必要时创建相册，并避免重复图片。 |
| `owner_cos.go` | 被 `POST /api/owner/assets` 和 `POST /api/ai/image` 调用 | 站长或服务端流程 + COS 凭据 | 使用服务器端腾讯 COS 凭据上传文章/相册/生成图片，并返回公开 URL 和对象 key。 |

重要请求形状：

| 路由 | 请求体/查询参数 | 说明 |
| --- | --- | --- |
| `POST /api/auth/register` | `{ "email": "...", "password": "..." }` | 普通用户注册；站长邮箱被保留。 |
| `POST /api/auth/login` | `{ "email": "...", "password": "..." }` | 站长登录会返回 `challengeToken`，还需要调用 `/api/auth/verify-security`。 |
| `POST /api/auth/verify-security` | `{ "challengeToken": "...", "answer": "..." }` | 私密答案匹配后创建站长会话，并获得无限 AI 额度。 |
| `GET /api/guestbook/messages?page=1&pageSize=20&channel=guestbook` | `channel` 可为 `guestbook` 或 `friends` | 普通访问者只看可见留言；站长/管理员可看隐藏留言。 |
| `POST /api/guestbook/messages` | `{ "nickname": "...", "contactEmail": "...", "content": "...", "parentId": 0, "channel": "guestbook" }` | 普通留言墙不强制 `contactEmail`。顶层 `friends` 友链留言不管匿名或登录，都必须提供 `nickname` 和 `contactEmail`；公开响应不会暴露 `contactEmail`。回复会忽略提交的 `contactEmail`，并在可用时通知父留言联系人或账号邮箱。 |
| `PATCH /api/guestbook/messages/:id` | `{ "status": "visible" \| "hidden" \| "deleted" }` | 仅站长/管理员审核。 |
| `GET /api/owner/emails` | 无请求体 | 仅站长可访问，返回注册用户邮箱和私有留言联系邮箱目录。 |
| `GET /api/ai/image` | 无请求体 | 返回生图额度、`imageEnabled`、`canGenerate`、当前模型和 `promptExtend: false`。 |
| `POST /api/ai/image` | `{ "prompt": "...", "size": "1024*1024" }` | 仅登录用户可用；普通用户每天 3 张，站长不限额度。支持 `1024*1024`、`1280*720`、`720*1280`，返回的 `image.url` 是最终腾讯 COS 链接。 |
| `POST /api/owner/uploads` | `multipart/form-data`，字段 `file` | 保存本地临时图片到 `ACG_DATA_DIR/owner-uploads`，最大 8 MiB。 |
| `POST /api/owner/assets` | `multipart/form-data`，字段 `file`、`kind` 为 `gallery` 或 `article`，可选 `album` | 上传到腾讯 COS；相册上传必须带相册。 |
| `POST /api/owner/publish` | `{ "draftId": 1, "title": "...", "body": "...", "coverUrl": "..." }` | 通过配置好的 token 产生真实 GitHub commit。 |
| `POST /api/owner/friends` | `{ "name": "...", "desc": "...", "url": "...", "avatar": "..." }` | `url` 和 `avatar` 必须是公开 `http`/`https` 地址。 |
| `POST /api/owner/moments` | `{ "year": "2026", "date": "6.8", "type": "...", "content": "..." }` | 写入一条碎语到 `main/src/data/moments.js`；`category` 也可作为 `type` 的兼容字段。 |
| `POST /api/owner/gallery/images` | `{ "albumId": "...", "albumTitle": "...", "imageUrl": "..." }` | `imageUrl` 必须是公开 `http`/`https` 地址。 |
| `POST /api/owner/ai/fixed-answers` | `{ "question": "...", "answer": "..." }` | 保存或更新仅站长可维护的固定答案。公开 `/api/chat` 会规范化用户问题并优先返回固定答案，再回退到 DeepSeek。 |

拉取/部署环境清单：

- 运行时：`ACG_API_ADDR` 默认 `:8787`；`ACG_DATA_DIR` 默认 `./data`。
- 站长登录：配置 `AUTH_OWNER_PASSWORD` 和 `AUTH_OWNER_SECURITY_ANSWER`；可选配置 `AUTH_SESSION_DAYS` 与 `AUTH_COOKIE_SECURE`。
- 重要身份说明：`owner.go` 里目前为本站部署保留了站长邮箱和安全问题文案。复用后端的人应该替换这些常量，或进一步改成环境变量。
- AI 助手：配置 `DEEPSEEK_API_KEY`；可选配置 `DEEPSEEK_BASE_URL` 和 `DEEPSEEK_MODEL`。
- AI 生图：配置 `DASHSCOPE_API_KEY`；可选配置 `DASHSCOPE_BASE_URL` 和 `AI_IMAGE_MODEL`（默认 `z-image-turbo`）。旧变量 `ALIYUN_BAILIAN_API_KEY` 也可作为百炼 Key 的兼容回退。
- 邮件通知：配置 `SMTP_HOST`、`SMTP_PORT`、`SMTP_USER`、`SMTP_PASS`、`SMTP_FROM_NAME` 和 `MAIL_NOTIFY_TO`。`SMTP_PASS` 应该使用邮箱服务商的授权码或应用密码，不要使用账号登录密码。
- GitHub 站长发布：配置 `OWNER_PUBLISH_GITHUB_TOKEN`；可选配置 `OWNER_PUBLISH_GITHUB_API_BASE`、`OWNER_PUBLISH_GITHUB_OWNER`、`OWNER_PUBLISH_GITHUB_REPO`、`OWNER_PUBLISH_GITHUB_BRANCH`。token 需要有写入仓库内容的权限。
- 腾讯 COS 上传：配置 `TENCENT_COS_SECRET_ID`、`TENCENT_COS_SECRET_KEY`、`TENCENT_COS_BUCKET`、`TENCENT_COS_REGION`，可选配置 `TENCENT_COS_BASE_URL`。也兼容旧变量 `COS_SECRET_ID`、`COS_SECRET_KEY`、`COS_BUCKET`、`COS_REGION`、`COS_BASE_URL`。
- Bili 同步：`BILIBILI_UID` 可以覆盖默认 UID；radar 创作者列表定义在 `acg-api/config.go`。
- 前端 API 地址：生产构建时让 `VITE_API_BASE` 指向部署后的站点域名，例如 `https://taozhiyy.top`。

安全边界：本仓库可能会暴露路由名称、控制器结构、环境变量名称、站长账号源码常量和部署 workflow 形状，但不应该包含我的站长登录密码、验证答案、GitHub token、COS 密钥、AI Key、服务器凭据、运行时 SQLite 数据库或私有 `.env`。后端上传/发布能力只有在真实凭据保存在服务器或 GitHub Actions secrets 中时才适合公开。别人拉取本项目后，仍然需要配置自己的密码、验证信息、密钥、数据库、部署主机和外部服务参数，不能直接复用我的后端私密信息。

如果你希望参考或复用后端逻辑，请先自行阅读、验证和测试，确保符合你的使用场景后再使用。

环境变量、密钥、服务器地址、数据库或外部服务配置请自行准备和配置，本仓库不会提供可直接复用的私密环境变量。

如果你在使用、阅读或部署过程中发现任何问题，或有任何建议，欢迎向我提出。

## 后续计划

- 服务器数据和状态监测：在站长控制台中展示服务健康、资源使用、同步状态和关键数据趋势。
- 打造生成图展示页面：把已生成并保存到 COS 的图片整理成可浏览、可回看、可管理的展示页。
- 设计艺术字主页：继续探索更有辨识度的首页标题与艺术字视觉方向。

## 非商业立场

本项目仅用于 **个人学习、技术探索、个人网站部署与非商业技术交流**。

我不会将该首页作为模板售卖，不会将其包装成商业产品，也不会用于商业盈利。如果本项目中有任何部分被认为不合适、与参考项目过于接近，或不适合公开展示，我愿意继续修改、替换或移除。

## 致谢

感谢原作者和开源/前端学习社区提供的高质量学习资源。这个项目的成长离不开这些公开项目、教程和工具带来的启发。
