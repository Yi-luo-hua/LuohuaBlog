# Taozhiyy Monorepo

桃之夭夭个人网站 monorepo，包含主站、成长博客子站、Hexo 博客、共享 AI 助手脚本和后端 API。

## Project Structure

- `main/`: 主站前端，基于 React、Vite、Tailwind CSS 和 GSAP。
- `build/`: 成长博客子站，用于记录本站从搭建到迭代的过程。
- `blog/`: Hexo + Butterfly 博客。
- `acg-api/`: Go 后端 API，包含留言板、AI 助手、Bili Hub 缓存同步等功能。
- `shared/`: 多个站点共用的脚本与样式，例如右下角 AI 助手。
- `deploy/`: 部署相关脚本。
- `.github/workflows/`: GitHub Actions 自动部署配置。

## Homepage Reference And Learning Notice

The homepage was initially created while studying and learning from the following tutorial/reference project:

[adrianhajdin/award-winning-website](https://github.com/adrianhajdin/award-winning-website)

I fully respect the original author's technical work and sincerely appreciate the educational value of the project. The referenced project helped me understand modern frontend animation, scroll-based interaction, video-driven visual composition, and immersive homepage structure.

This repository is **not affiliated with, endorsed by, or commercially connected to** the original author, the tutorial project, or Zentry. The reference is stated openly here to avoid misleading visitors and to make the learning source clear.

## Original Work In This Site

Although the homepage began as a learning exercise inspired by the project above, the current site is not intended to be a direct copy or simple reuse. I have been progressively rebuilding the page around my own website identity, materials, features, and interaction ideas.

Current original/customized parts include:

- A custom hero wallpaper selector based on a compass/avatar badge interaction.
- Personal homepage wording and site identity for `桃之夭夭`.
- A redesigned visual postcard-style About section.
- A gallery/archive-book interaction for the feature cards.
- Custom routing and integrations for the blog, build log, Bili Hub, AI assistant, and guestbook.
- A backend API for comments, AI assistant context, Bili data caching, and related site functions.
- Site-specific deployment, caching, and server configuration for my own domain and UCloud server.

The goal is to keep the learning value of the reference while continuing to move the public website toward a clearly personal and original implementation.

## Non-Commercial Position

This project is only used for **personal learning, technical exploration, and non-commercial communication**.

I will not sell this homepage as a template, package it as a commercial product, or use it for commercial profit. If any part of the site is considered inappropriate, too close to the referenced work, or unsuitable for public display, I am willing to revise or remove it.

## Respect For The Original Author

I respect the original author's work and do not claim ownership over the tutorial project's design, code, or creative direction. Any similarity comes from my learning process, and this README keeps the reference transparent.

Thank you to the original author and the open-source/frontend learning community for making high-quality learning resources available.

## Notes

This repository is primarily for my personal website, personal experimentation, and deployment practice. The homepage reference should be understood as a learning source, not as a claim that the original tutorial design belongs to this project.
