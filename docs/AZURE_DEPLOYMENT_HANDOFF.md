# Azure 部署交接文档

> 面向后续接手本项目的 Claude/Codex。最后核验时间：2026-08-25（Asia/Shanghai）。

## 1. 当前结论

LuohuaBlog 已经部署到 Azure for Students 虚拟机，并可通过公网 IP 访问。

| 入口 | 地址 | 最近核验 |
| --- | --- | --- |
| 主站（React/Vite） | <http://65.52.160.147/> | HTTP 200，Chrome 实际渲染正常 |
| Hexo/Butterfly 博客 | <http://65.52.160.147/blog/> | HTTP 200 |
| API 健康检查 | <http://65.52.160.147/api/v1/health> | HTTP 200，`status: ok` |
| 服务器信息 | <http://65.52.160.147/api/server/info> | HTTP 200 |

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
| 开放端口 | Azure NSG 已开放 22、80、443；当前只有 22 和 80 实际提供服务 |

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

## 6. 无 HTTPS 时的临时安全限制

目前只通过 `http://65.52.160.147` 提供服务，没有域名和 TLS 证书。为避免密码、登录 Cookie、留言内容或 AI 请求通过明文 HTTP 传输，Nginx 对 `/api/` 仅允许：

```text
GET
HEAD
OPTIONS
```

所有 POST/PATCH/DELETE 等写请求统一返回 HTTP 403。最近验证：向 `/api/auth/login` 发送 POST 得到 403。

因此目前以下功能有意不可用：

- 注册和登录
- 站长登录与控制台写操作
- 留言提交和管理
- AI 对话、生图等 POST 请求
- 通过后端发布文章、动态、友链或相册

不要为了“让按钮能用”直接移除该限制。应先完成域名和 HTTPS，再开放写请求。

## 7. 当前后端环境状态

服务器 `/opt/acg-api/.env` 只包含非敏感运行配置，包括：

```text
ACG_API_ADDR=127.0.0.1:8787
ACG_DATA_DIR=/var/lib/acg-api
ACG_ALLOWED_ORIGINS=http://65.52.160.147
AUTH_COOKIE_SECURE=true
GITHUB_ACTIVITY_LOGIN=Yi-luo-hua
BANGUMI_USERNAME=936756
SERVER_VENDOR=Microsoft Azure
SERVER_REGION=East Asia - Hong Kong
```

`BANGUMI_USERNAME` 不是密钥。Bangumi 的收藏列表是公开的，只要知道用户名就能读，
所以番剧页在一个不存放任何密钥的部署上也能正常显示（当前 248 条）。
`BANGUMI_ACCESS_TOKEN` 仍然可选，作用是让标记为私有的收藏也可见。

后端构建绝对链接（目前只有通知邮件里的回链）时读 `SITE_PUBLIC_ORIGIN`；没设置就回退到
`ACG_ALLOWED_ORIGINS` 的第一项，所以现在不配也是对的。换域名时改 `ACG_ALLOWED_ORIGINS`
即可，两者会一起跟上。

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
服务器上的 `.env` 和 `/var/lib/acg-api`——这两样丢了没法从仓库恢复。

原先从模板继承的那套 UCloud 拉取式部署（`pull-deploy.sh`、`install-pull-deploy.sh`、
`taozhiyy-pull-deploy.service/.timer`、`PULL_BASED_DEPLOY.md`）已删除：它指向
`/opt/taozhiyy-source`、`taozhiyy-deploy` 用户和 `/var/www/taozhiyy`，和这台机器没有
任何关系，留着只会误导人。

当前线上版本是 2026-08-25 从本机工作树构建上传的快照。

本地仓库当时存在主人尚未提交的 `main/` 改动，线上主站包含这些改动。因此：

1. 不要假设线上版本等于 `origin/master`。
2. 不要执行 `git reset --hard`、`git checkout -- .` 或其他会覆盖工作树的命令。
3. 重新部署前先运行 `git status --short --branch`，确认主人希望发布哪些本地内容。
4. 构建 Hexo 会改动 `blog/db.json`；它是生成缓存，不应混入提交。部署后应恢复或排除该文件。

## 9. 本次构建参数与验证

主站构建使用：

```text
VITE_API_BASE=
VITE_SITE_HOST=65.52.160.147
VITE_SITE_APP_HOST=app.invalid
```

`VITE_API_BASE` 为空表示浏览器使用同源 `/api`。`VITE_SITE_APP_HOST=app.invalid` 是临时禁用独立 PWA 主机，不能把它设置成与公网 IP 相同，否则访问 `/` 会被识别为站长控制台并显示 `Owner login required`。

本次验证结果：

- `main` Node 测试：137/137 通过（`cd main && node --test "src/**/*.test.js"`）
- `tools/` Python 守卫测试：35/35 通过（`python -m pytest tools/ -q`）
- `go test ./...`：通过
- `main` Vite 生产构建：通过
- Go Linux amd64 静态二进制构建：通过
- Nginx 配置测试：通过
- Nginx 和 `acg-api` 服务：`active`
- 产物检查：不含 `taozhiyy`，不含 `https://65.52.160.147`

`main` 里剩余的 eslint 报错都在 `main/public/web/` 和 `main/public/showcase/` —— 那是
随站发布的 QuizCard 独立应用，不是 React 源码，本次没有改动。

**构建后不再需要任何手工替换。** 早先那一步（把产物里的 `https://65.52.160.147` 改成
`http://`，把 `https://example.com/blog` 改成真实博客地址）已经从流程里去掉，因为它
每次重新构建都得记着做一遍，忘一次就上线一批错链接。现在：

- `main/src/lib/siteIdentity.js` 按主机推断协议——裸 IP 和 `localhost` 用 `http`，
  域名用 `https`，需要时可用 `VITE_SITE_PROTOCOL` 覆盖。所以 `VITE_SITE_HOST=65.52.160.147`
  直接产出 `http://65.52.160.147`。
- `blog/_config.yml` 的 `url` 已经写成当前博客地址，不再是 `example.com` 占位。

## 10. 后续获得域名后的正确迁移顺序

1. 给根域名或子域名添加指向 `65.52.160.147` 的 DNS A 记录。
2. 将 Nginx `server_name` 改成真实域名，并保留 IP 访问的重定向或默认站点策略。
3. 使用 Certbot 或其他 ACME 客户端申请证书，确认 443 实际监听且 HTTP 自动跳转 HTTPS。
4. 用真实值重新部署：`SITE_HOST=<domain> SITE_APP_HOST=app.<domain> deploy/deploy-azure.sh`
   （协议会自动从 `http` 变成 `https`，不需要额外参数）。
5. 将 `blog/_config.yml` 的 `url` 改为 `https://<domain>/blog`。
6. 将服务器 `ACG_ALLOWED_ORIGINS` 改为真实 HTTPS 来源，并继续保持 `AUTH_COOKIE_SECURE=true`。
7. 验证 HTTPS、Cookie、CORS 和 CSRF/来源边界后，才从 Nginx 移除只读方法限制。
8. 再逐项配置站长密码、二次验证答案、Bangumi、AI、SMTP、GitHub 和 COS 等服务器密钥。
9. 最后重新测试注册、登录、留言、AI、站长发布以及 SQLite 备份。

## 11. 交接原则

- 当前公开访问已经可用，不要把“动态功能未配置”误判为整个部署失败。
- 任何真实密钥只允许进入服务器 `/opt/acg-api/.env`，不能提交。
- 修改 Nginx 前先备份并执行 `sudo nginx -t`，通过后再 reload。
- 替换后端二进制前保留 `/var/lib/acg-api`，不要删除生产数据库。
- 自动部署仍未启用。现在的发布入口是 `deploy/deploy-azure.sh`，以本地工作树为源；
  若要改成自动拉取，应先决定以哪个 Git 分支为准，并把工作树里未提交的内容处理掉。
- 公网 IP、磁盘和出站流量可能持续消耗 Azure 学生额度，应设置成本告警并定期检查账单。
