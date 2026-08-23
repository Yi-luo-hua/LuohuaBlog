# Claudian → 伊洛华博客发布桥

这是一条只从本机向博客发布的 MCP 工具链：

`Obsidian Markdown → Claudian → publish_blog_post → GitHub CLI → GitHub → 自动部署`

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

`title` 也可省略，发布桥会依次采用第一个一级标题和文件名。正文中的本地图片与封面会在正式发布时自动上传到 `img.scdn.io`，原 Obsidian 笔记不会被改写。

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

同一张本地图片同时用作正文插图和封面时只上传一次。支持 jpg、jpeg、png、webp、gif、bmp、tif、tiff；单篇文章最多自动上传 40 张。

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

发布工具会先上传本地图片并替换发布副本中的链接，再通过 GitHub Contents API 把文章写到 `blog/source/_posts/`。现有部署链会重新构建主站与 Hexo 文章页。

## 安全边界

- MCP 只能读取 `OBSIDIAN_VAULT_ROOT` 内的 `.md` 文件。
- GitHub 凭据只由 GitHub CLI 钥匙串管理，不会进入 Obsidian 笔记、MCP 配置或仓库。
- `dry_run=true` 只检查图片、封面与目标路径，不上传图片，也不产生 GitHub commit。
- 图床没有事务或删除 API；若图片上传后 GitHub 提交失败，已上传图片可能成为未引用资源。
