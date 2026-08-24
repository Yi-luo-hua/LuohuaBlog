# Claudian → 伊洛华博客发布桥

这是一条只从本机向博客发布的 MCP 工具链：

`Obsidian Markdown → Claudian → publish_blog_post → GitHub CLI → GitHub → deploy/deploy-azure.sh blog`

## 1. 文章格式

在 Obsidian 中新建 Markdown，推荐保留下面的 front matter：

```markdown
---
title: 我的新文章
date: 2026-08-24 20:00:00
tags: [Obsidian, 随笔]
categories: [记录]
cover: ./assets/cover.png
description: 一句话摘要
---

# 我的新文章

正文……
```

`title` 也可省略，发布桥会依次采用第一个一级标题和文件名。正文中的本地图片与封面会在正式发布时提交进仓库（见下一节），原 Obsidian 笔记不会被改写。

封面支持四种写法：

```yaml
# 指定本地图片（也支持 "[[assets/cover.png]]"）
cover: ./assets/cover.png

# 指定已有外链
cover: https://example.com/cover.webp

# 留空或 auto：复用正文第一张图片
cover: auto

# 明确不设置封面
cover: none
```

同一张本地图片同时用作正文插图和封面时只提交一次。支持 jpg、jpeg、png、webp、gif、bmp、tif、tiff；单张上限 10 MB，单篇文章最多 40 张。

## 图片存在哪里

图片不再传给第三方图床，而是跟文章一起提交进本仓库：

```text
blog/source/images/<年>/<月>/<内容散列>-<文件名>.png
        ↓  hexo generate
线上地址：/blog/images/<年>/<月>/<内容散列>-<文件名>.png
```

文件名里的散列来自图片自身的字节，所以：

- 同一篇笔记重复发布不会堆出重复文件，已存在就跳过
- 图片内容变了地址就变，不会被缓存卡住
- 图片和引用它的文章在同一个仓库里，重装服务器时 checkout 就能恢复

之前的做法是上传到 `img.scdn.io` 再把返回的外链写进文章。那些图片不在你控制范围内：图床过期、改域名或删文件，文章里就多一个死链，而且本地没有任何副本。

## 2. GitHub 登录

发布桥直接调用 GitHub CLI，不需要常驻后台、API 地址或额外发布令牌。首次使用只需登录一次：

```powershell
gh auth login
```

凭据由 GitHub CLI 保存在系统钥匙串中。发布桥只在调用工具时启动一个短生命周期的 `gh` 进程，结束后不会驻留。

## 3. 添加 MCP

Claudian 复用所选编码代理自己的 MCP 配置。以 Claude Code 为例，在普通 PowerShell 中执行：

```powershell
claude mcp add --scope user yi-luo-hua-blog -- node "E:\TOOLS\BLOG\integrations\claudian-blog-mcp\server.mjs"
```

随后重启 Claudian。它应能看到 `publish_blog_post` 工具。

## 4. 在 Claudian 中发布

推荐先预检，再正式发布：

```text
请检查当前笔记的标题、摘要、标签和分类，调用 publish_blog_post，source_path 使用当前笔记路径，dry_run=true。
```

确认无误后：

```text
按刚才的内容正式发布，调用 publish_blog_post，dry_run=false。不要改动其他笔记。
```

发布工具会先把本地图片提交到 `blog/source/images/` 并替换发布副本中的链接，再通过 GitHub Contents API 把文章写到 `blog/source/_posts/`。

注意：**到这一步文章只是进了 GitHub，线上还是旧的。** 本仓库没有自动部署（继承自模板的拉取式部署指向的是别人的服务器，已删除）。发完要自己跑一次：

```bash
git pull && deploy/deploy-azure.sh blog
```

## 安全边界

- MCP 只能读取 `OBSIDIAN_VAULT_ROOT` 内的 `.md` 文件。
- GitHub 凭据只由 GitHub CLI 钥匙串管理，不会进入 Obsidian 笔记、MCP 配置或仓库。
- `dry_run=true` 只检查图片、封面与目标路径，并列出每张图片将来的线上地址，不产生任何 GitHub commit。
- 图片先于文章提交；若文章提交失败，已提交的图片会成为仓库里的未引用文件。它们在 git 里看得见、删得掉，不像图床那样无法回收。
