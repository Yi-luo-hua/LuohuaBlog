# Azure 部署交接文档

> 面向后续接手本项目的 Claude/Codex。最后核验时间：2026-08-25（Asia/Shanghai）。

## 1. 当前结论

LuohuaBlog 已经部署到 Azure for Students 虚拟机，并通过 `yiluohua.top` 提供 HTTPS 服务。

| 入口 | 地址 | 最近核验 |
| --- | --- | --- |
| 主站（React/Vite） | <https://yiluohua.top/> | HTTPS 200 |
| 站长 PWA | <https://app.yiluohua.top/> | HTTPS 200，非站长会进入登录门禁 |
| Hexo/Butterfly 博客 | <https://yiluohua.top/blog/> | HTTPS 200 |
| API 健康检查 | <https://yiluohua.top/api/v1/health> | HTTPS 200，`status: ok` |
| 服务器信息 | <https://yiluohua.top/api/server/info> | HTTPS 200 |

两个 README 里“尚未部署”的描述已经改掉，现在与本文档一致。

`/build/` 子站已于 2026-08-25 整体删除：它从模板继承而来，线上提供的是模板作者
「桃之夭夭」本人的站点——标题「桃之夭夭の创作屋」、页脚署名、22 篇他写的文章和他的
B 站链接，全部挂在本站 IP 下对外公开。源码、服务器目录和 Nginx 路由都已移除，首页
原本指向它的「创造纪事」卡片也一并删掉。`/build/` 现在会落到主站 SPA 的 index.html
并被前端路由送回首页。

## 2. Azure 资源

| 项目 | 当前值 |
| --- | --- |
| 订阅 | Azure for Students |
| 资源组 | `blog-rg` |
| 虚拟机 | `blog-server` |
| 区域 | East Asia（香港） |
| 机型 | `Standard_B2ats_v2`，x64，2 vCPU，约 1 GiB RAM |
| 系统 | Ubuntu Server 24.04 LTS |
| OS 磁盘 | 约 64 GiB（系统内可用容量约 61 GiB） |
| 公网 IPv4 | `65.52.160.147` |
| 私网 IPv4 | `172.16.0.4` |
| 虚拟网络 | `vnet-eastasia-1` / `snet-eastasia-1` |
| 开放端口 | Azure NSG 已开放 22、80、443；三者均按预期提供服务 |

该学生订阅的区域策略只允许以下区域：

```text
japaneast
centralindia
indonesiacentral
eastasia
koreacentral
```

不要在其他区域重建资源，否则会收到 `RequestDisallowedByAzure`。

## 3. SSH 登录

本机已配置 SSH 别名：

```powershell
ssh blog-server
```

等价的完整命令：

```powershell
ssh -i "E:\TOOLS\blog-server-key.pem" azureuser@65.52.160.147
```

相关本地文件：

- 私钥路径：`E:\TOOLS\blog-server-key.pem`
- SSH 配置：`C:\Users\丁家宝\.ssh\config`
- SSH 用户：`azureuser`

私钥 ACL 已收紧为仅当前 Windows 账户可读。绝对不要读取私钥内容到日志、聊天、提交、构建产物或服务器网页目录中。

## 4. 服务器目录与服务

### 静态文件

```text
/var/www/luohua/main/   # main/dist
/var/www/luohua/blog/   # blog/public
/var/www/luohua/cos/    # 站点媒体资源（26 MB，75 个文件），由 Nginx 直接读盘
```

### Go API

```text
/opt/acg-api/acg-api       # Linux amd64 二进制
/opt/acg-api/.env          # root:root，0600，禁止下载或输出
/var/lib/acg-api/acg.db    # SQLite 运行时数据
```

### systemd 与 Nginx

```text
/etc/systemd/system/acg-api.service
/etc/nginx/sites-available/luohua
/etc/nginx/sites-enabled/luohua -> /etc/nginx/sites-available/luohua
```

服务使用非登录系统用户 `acg-api` 运行，而不是 root。服务单元启用了 `NoNewPrivileges`、`ProtectSystem=strict`、`ProtectHome=true`，并只允许写入 `/var/lib/acg-api`。

常用诊断命令：

```bash
sudo systemctl status nginx acg-api --no-pager
sudo journalctl -u acg-api -n 100 --no-pager
sudo nginx -t
curl -fsS http://127.0.0.1/api/v1/health
```

## 5. 当前 Nginx 路由

| 路径 | 行为 |
| --- | --- |
| `/` | 主站 SPA，未知前端路由回退到 `/index.html` |
| `/blog/` | 读取 `/var/www/luohua/blog/` |
| `/api/` | 反向代理到 `127.0.0.1:8787` |
| `/cos/` | `alias /var/www/luohua/cos/`，直接读本机磁盘，缓存 30 天 |

**`/cos/` 曾经反向代理到模板作者的腾讯 COS 桶**（`tzyy-1330068502.cos.ap-beijing.myqcloud.com`）：
首页视频、Hero 图、相册和关于页的图片全部从对方的存储取，走对方的流量，对方删文件或
开防盗链本站就会大面积裂图。2026-08-25 已把站点实际引用的 75 个文件（26 MB）下载到
`/var/www/luohua/cos/`，Nginx 改成读本地目录。

前端一行没改，因为它从来只引用同源的 `/cos/` 前缀（见 `main/src/lib/cosAsset.js`）。
`main/vite.config.js` 的开发代理也从那个桶改成了指向本站，所以本地开发同样不再依赖它，
需要时可用 `VITE_COS_ORIGIN` 覆盖。

校验方式：请求任意 `/cos/` 资源，响应头里不应再出现 `X-Cos-*`。

换服务器时记得把 `/var/www/luohua/cos/` 一起搬走——这些文件只在这台机器上，仓库里没有。

## 5.1 压缩（改过 nginx.conf，不在仓库里）

Ubuntu 自带的 `/etc/nginx/nginx.conf` 里只有 `gzip on;` 生效，`gzip_types` 和
`gzip_proxied` 都是注释掉的。nginx 的 `gzip_types` 默认值只有 `text/html`，
而不设 `gzip_proxied` 时反代响应（也就是所有 `/api/` 的 JSON）一律不压缩。
结果是 CSS、JS 和所有接口返回都是明文全量传输。2026-08-25 已打开：

```nginx
gzip_vary on;
gzip_proxied any;
gzip_comp_level 6;
gzip_min_length 1024;
gzip_types text/plain text/css application/json application/javascript
           application/x-javascript text/xml application/xml
           application/xml+rss text/javascript image/svg+xml
           application/manifest+json;
```

实测效果：CSS 204 KB → 40 KB，JS 455 KB → 150 KB，番剧接口 159 KB → 55 KB。

**这一改动在 `/etc/nginx/nginx.conf`，不在本仓库里**。重装系统或换服务器时
要记得重新设一次，否则会静默地退回到全明文传输。验证：

```bash
curl -s -o /dev/null -D - -H "Accept-Encoding: gzip"   https://yiluohua.top/api/v1/bangumi/list?status=watched | grep -i content-encoding
```

备份在 `/etc/nginx/nginx.conf.bak-*`。

## 5.2 静态资源缓存

2026-08-25 已为静态资源补上明确的浏览器缓存策略，配置源文件为
`deploy/nginx-luohua.conf`，发布脚本会在安装前备份线上站点配置，并在 `nginx -t`
失败时自动恢复旧配置：

| 资源 | 策略 |
| --- | --- |
| Vite 内容哈希资源、带内容哈希的字体 | `1y`，`public, immutable` |
| 未哈希的 CSS/JS | `1h`，`public` |
| 图片、字体、音视频与 `/cos/` | `30d`，`public` |
| HTML、SPA 回退页、`sw.js` | `no-cache`，每次复用前重新验证 |
| `/api/` | 不套用静态资源缓存规则 |

不能把全部 JS/CSS 都设成一年不可变缓存：Hexo 和独立工具仍使用固定文件名，重新部署时
会覆盖原文件；只有 URL 中带内容哈希、内容变化就会换 URL 的文件才适合 `immutable`。

验证示例：

```bash
curl -I https://yiluohua.top/assets/index-CCfkrm55.js
curl -I https://yiluohua.top/blog/css/index.css
curl -I https://yiluohua.top/
```

## 6. HTTPS 与 API 写请求状态

`yiluohua.top`、`www.yiluohua.top` 和 `app.yiluohua.top` 共用一张 Let's Encrypt ECDSA
证书。HTTP 和公网 IP 请求统一以 308 跳转到 `https://yiluohua.top`，443 已实际监听。
证书由 `certbot.timer` 自动续期，当前证书到期日为 2026-11-23。

原先为了防止密码和 Cookie 走明文而设置的 API 只读限制已经移除。POST/PATCH/DELETE
现在会到达 Go API；无效登录请求返回 401，而不是 Nginx 的 403。`AUTH_COOKIE_SECURE=true`
保持不变，CORS 只允许三个正式 HTTPS 来源。

写请求能够到达后端不代表所有动态功能都已配置完成。AI、邮件、GitHub 发布和站长登录等
仍取决于各自的服务器密钥；未配置时应按后端设计降级或返回明确错误。

## 7. 当前后端环境状态

服务器 `/opt/acg-api/.env` 只包含非敏感运行配置，包括：

```text
ACG_API_ADDR=127.0.0.1:8787
ACG_DATA_DIR=/var/lib/acg-api
ACG_ALLOWED_ORIGINS=https://yiluohua.top,https://www.yiluohua.top,https://app.yiluohua.top
SITE_PUBLIC_ORIGIN=https://yiluohua.top
AUTH_COOKIE_SECURE=true
GITHUB_ACTIVITY_LOGIN=Yi-luo-hua
BANGUMI_USERNAME=936756
SERVER_VENDOR=Microsoft Azure
SERVER_REGION=East Asia - Hong Kong
```

`BANGUMI_USERNAME` 不是密钥。Bangumi 的收藏列表是公开的，只要知道用户名就能读，
所以番剧页在一个不存放任何密钥的部署上也能正常显示（当前 248 条）。
`BANGUMI_ACCESS_TOKEN` 仍然可选，作用是让标记为私有的收藏也可见。

后端构建绝对链接（目前只有通知邮件里的回链）时读 `SITE_PUBLIC_ORIGIN`；该值已明确设置
为正式根域名，不再依赖允许来源列表的回退顺序。

真实密钥尚未配置，因此 AI、邮件通知、站长登录、GitHub 发布和 COS 管理能力会处于未配置或降级状态。需要配置时，以 `acg-api/.env.example` 为变量名清单，只在服务器 `/opt/acg-api/.env` 中写真实值，禁止写入仓库或聊天记录。

修改服务器环境后：

```bash
sudoedit /opt/acg-api/.env
sudo systemctl restart acg-api
sudo systemctl status acg-api --no-pager
```

## 8. 当前部署方式

推送式部署，没有自动 timer，服务器上也没有 git 检出和构建工具链——所有东西都在本机
构建好再上传。

```bash
deploy/deploy-azure.sh              # 全量
deploy/deploy-azure.sh main         # 只发主站
deploy/deploy-azure.sh blog api     # 任意子集
```

脚本会构建 acg-api（linux/amd64）、主站和博客，用 `tar` over `ssh` 上传（Windows 的
Git Bash 没有 rsync），然后 `nginx -t` 通过才 reload，最后逐个 curl 校验。它**不会**碰
服务器上的 `.env` 和 `/var/lib/acg-api`——这两样丢了没法从仓库恢复。脚本还会在 Hexo
构建前备份 `blog/db.json`，完成或失败退出时恢复，避免生成缓存污染工作树。

原先从模板继承的那套 UCloud 拉取式部署（`pull-deploy.sh`、`install-pull-deploy.sh`、
`taozhiyy-pull-deploy.service/.timer`、`PULL_BASED_DEPLOY.md`）已删除：它指向
`/opt/taozhiyy-source`、`taozhiyy-deploy` 用户和 `/var/www/taozhiyy`，和这台机器没有
任何关系，留着只会误导人。

当前线上版本是 2026-08-25 从本机工作树构建上传的快照。

本地仓库当时存在主人尚未提交的 `main/` 改动，线上主站包含这些改动。因此：

1. 不要假设线上版本等于 `origin/master`。
2. 不要执行 `git reset --hard`、`git checkout -- .` 或其他会覆盖工作树的命令。
3. 重新部署前先运行 `git status --short --branch`，确认主人希望发布哪些本地内容。
4. `blog/db.json` 是生成缓存，不应混入提交；部署脚本已自动保存并恢复它。

## 9. 本次构建参数与验证

主站构建使用：

```text
VITE_API_BASE=
VITE_SITE_HOST=yiluohua.top
VITE_SITE_APP_HOST=app.yiluohua.top
```

`VITE_API_BASE` 为空表示浏览器使用同源 `/api`。根域名保持公开站点行为；只有
`app.yiluohua.top` 会启用站长 PWA 门禁和控制台入口。

本次验证结果：

- `main` Node 测试：138/138 通过（`cd main && node --test "src/**/*.test.js"`）
- `tools/` Python 守卫测试：53/53 通过（`python -m pytest tools/ -q`）
- `go test ./...`：通过
- `main` Vite 生产构建：通过
- Nginx 配置测试：通过
- Nginx、`acg-api` 和 `certbot.timer`：`active`
- HTTPS 主站、博客、API 和 PWA：均返回 200
- HTTP：308 跳转到正式 HTTPS 域名
- 无效登录 POST：401，证明写请求已到达 Go API

`main` 里剩余的 eslint 报错都在 `main/public/web/` 和 `main/public/showcase/` —— 那是
随站发布的 QuizCard 独立应用，不是 React 源码，本次没有改动。

**构建后不再需要任何手工替换。** 早先那一步（把产物里的 `https://65.52.160.147` 改成
`http://`，把 `https://example.com/blog` 改成真实博客地址）已经从流程里去掉，因为它
每次重新构建都得记着做一遍，忘一次就上线一批错链接。现在：

- `main/src/lib/siteIdentity.js` 按主机推断协议——裸 IP 和 `localhost` 用 `http`，
  域名用 `https`，需要时可用 `VITE_SITE_PROTOCOL` 覆盖。当前构建直接产出
  `https://yiluohua.top` 和 `https://app.yiluohua.top`。
- `blog/_config.yml` 的 `url` 已经写成 `https://yiluohua.top/blog`。

## 10. 域名、DNS 与证书维护

DNSPod 当前权威 DNS 为 `dance.dnspod.net` 和 `lester.dnspod.net`，记录如下：

| 主机 | 类型 | 值 |
| --- | --- | --- |
| `@` | A | `65.52.160.147` |
| `www` | CNAME | `yiluohua.top` |
| `app` | CNAME | `yiluohua.top` |

证书文件只存在服务器的 `/etc/letsencrypt/live/yiluohua.top/`，不能提交、下载或输出私钥。
续期健康检查：

```bash
sudo certbot certificates
sudo certbot renew --dry-run
systemctl status certbot.timer --no-pager
```

Nginx 的 HTTP ACME webroot 是 `/var/www/letsencrypt`；`deploy/nginx-luohua.conf` 必须保留
`/.well-known/acme-challenge/` 例外，否则未来自动续期会失败。公网 IP 变化时，应先更新
DNSPod 的根域名 A 记录，再检查两个 CNAME 是否仍跟随根域名。

## 11. 交接原则

- 当前公开访问已经可用，不要把“动态功能未配置”误判为整个部署失败。
- 任何真实密钥只允许进入服务器 `/opt/acg-api/.env`，不能提交。
- 修改 Nginx 前先备份并执行 `sudo nginx -t`，通过后再 reload。
- 替换后端二进制前保留 `/var/lib/acg-api`，不要删除生产数据库。
- 自动部署仍未启用。现在的发布入口是 `deploy/deploy-azure.sh`，以本地工作树为源；
  若要改成自动拉取，应先决定以哪个 Git 分支为准，并把工作树里未提交的内容处理掉。
- 公网 IP、磁盘和出站流量可能持续消耗 Azure 学生额度，应设置成本告警并定期检查账单。
