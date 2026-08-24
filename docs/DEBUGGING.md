# 本地调试说明

## Bangumi 番剧数据无法显示

### 现象

- `/bangumi/watching` 显示“暂时没有读到 Bangumi 数据”或 `Sync unavailable`。
- 浏览器控制台中的 `/api/v1/bangumi/list` 请求返回 `502 Bad Gateway`。

### 原因

`main` 目录中的 `npm run dev` 只会启动 Vite 前端。开发环境会把 `/api` 请求代理到 `http://127.0.0.1:8787`，因此还需要单独启动 `acg-api` Go 后端。

### 推荐：一条命令启动

在仓库根目录运行：

```powershell
cd E:\TOOLS\BLOG
.\dev.ps1
```

`dev.ps1` 会同时检查并启动前端 `5173` 与后端 `8787`。进程使用独立的隐藏窗口运行，不依赖当前 Codex 调试终端；已经运行的服务会被复用，不会重复启动。

常用命令：

```powershell
# 查看前后端状态
.\dev.ps1 status

# 只停止由 dev.ps1 启动的进程
.\dev.ps1 stop
```

运行日志位于仓库根目录的 `.dev-runtime/`，该目录已加入 `.gitignore`。

### 手动启动方式

打开两个终端并分别运行：

```powershell
# 终端 1：前端
cd E:\TOOLS\BLOG\main
npm run dev
```

```powershell
# 终端 2：后端
cd E:\TOOLS\BLOG\acg-api
go run .
```

后端默认监听 `127.0.0.1:8787`。确认后端启动完成后，刷新番剧页面即可。

如果后端由 Codex 的临时执行终端直接运行，任务回合结束、终端会话被回收时，`go run .` 也会一起退出。这就是前端仍在而番剧数据再次消失的常见原因；本地长期调试请优先使用根目录的 `dev.ps1`。

### 快速确认

```powershell
Get-NetTCPConnection -State Listen -LocalPort 8787
```

如果没有任何输出，说明本地后端尚未启动。`BANGUMI_ACCESS_TOKEN` 保存在 `acg-api/.env`，不要写入任何 `VITE_` 前缀的前端变量。

### 部署环境

生产环境由 systemd 运行 `acg-api`，Nginx 将 `/api/` 转发到 `127.0.0.1:8787`。只要服务正常运行且 token 有效，页面会读取服务器 SQLite 中定时同步的 Bangumi 缓存；本地需要手动启动两个进程的问题不会影响生产部署。
