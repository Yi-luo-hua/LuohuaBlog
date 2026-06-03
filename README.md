# Taozhiyy Monorepo / 桃之夭夭 Monorepo

> 中文说明在前，English version follows.

## 中文说明

这是我的个人网站 `桃之夭夭` 的 monorepo，包含主站、成长博客子站、Hexo 博客、共享 AI 助手脚本和后端 API。

### 项目结构

- `main/`: 主站前端，基于 React、Vite、Tailwind CSS 和 GSAP。
- `build/`: 成长博客子站，用于记录本站从搭建到迭代的过程。
- `blog/`: Hexo + Butterfly 博客。
- `acg-api/`: Go 后端 API，包含留言板、AI 助手、Bili Hub 缓存同步等功能。
- `shared/`: 多个站点共用的脚本与样式，例如右下角 AI 助手。
- `deploy/`: 部署相关脚本。
- `.github/workflows/`: GitHub Actions 自动部署配置。

### 首页参考与学习声明

本项目首页最初是在学习和参考以下项目的过程中搭建起来的：

[adrianhajdin/award-winning-website](https://github.com/adrianhajdin/award-winning-website)

我非常尊重原作者的劳动成果，也感谢该项目对我学习现代前端动画、滚动交互、视频视觉布局和沉浸式页面结构带来的帮助。

需要明确说明的是：**当前项目并不是完全原创作品**。它仍然是在原作者项目的启发与学习基础上，逐步进行修改、重构和原创化改进的个人学习项目。

我一直秉持尊重原作者劳动成果的理念推进项目原创化。无论这个项目未来原创化推进到多少完成度，哪怕有一天达到接近 100% 的个人实现，我也不会忘记这些开源项目和优秀教程曾经对我的帮助。

本仓库与原作者、原教程项目或 Zentry 没有任何从属、授权、商业合作或官方关联关系。本说明公开写明参考来源，是为了保持透明，也避免让访问者误以为本项目完全脱离参考来源而独立产生。

### 本项目中的原创与定制部分

目前我已经围绕个人网站定位做了大量原创化和定制化改造，包括但不限于：

- 基于头像徽章与指南针交互的 Hero 壁纸选择器。
- `桃之夭夭` 个人站点身份、文案与内容组织。
- About 区域的视觉明信片式滚动展示。
- Features 区域的展厅布局与档案书翻页交互。
- Blog、Build Log、Bili Hub、AI 助手、留言板等站内功能路由与集成。
- 留言、AI 上下文、Bili 数据缓存等后端 API。
- 适配个人域名、UCloud 服务器、GitHub Actions 自动部署的工程配置。

这些原创化和定制化部分主要借助 **vibecoding** 的方式完成：我提出需求、判断方向、筛选效果并持续迭代，AI 编程工具辅助实现代码与视觉细节。

由我本人完成、设计、组织或通过 vibecoding 推进出的原创部分，可以在尊重本说明的前提下自由参考、学习和使用。

但如果某些内容涉及原参考项目的设计、结构、交互思路或代码来源，请不要直接从本仓库视为授权来源；请自行前往原作者项目查阅其说明、许可和使用边界。

### 非商业立场

本项目仅用于 **个人学习、技术探索、个人网站部署与非商业技术交流**。

我不会将该首页作为模板售卖，不会将其包装成商业产品，也不会用于商业盈利。如果本项目中有任何部分被认为不合适、与参考项目过于接近，或不适合公开展示，我愿意继续修改、替换或移除。

### 致谢

感谢原作者和开源/前端学习社区提供的高质量学习资源。这个项目的成长离不开这些公开项目、教程和工具带来的启发。

---

## English Version

This is the monorepo for my personal website `Taozhiyy / 桃之夭夭`, including the main site, build-log subsite, Hexo blog, shared AI assistant scripts, and backend API.

### Project Structure

- `main/`: Main frontend site, built with React, Vite, Tailwind CSS, and GSAP.
- `build/`: Build-log subsite for recording how this website is built and iterated.
- `blog/`: Hexo + Butterfly blog.
- `acg-api/`: Go backend API, including guestbook, AI assistant, Bili Hub cache sync, and related features.
- `shared/`: Shared scripts and styles used by multiple sites, such as the floating AI assistant.
- `deploy/`: Deployment-related scripts.
- `.github/workflows/`: GitHub Actions deployment configuration.

### Homepage Reference And Learning Notice

The homepage was initially created while studying and learning from the following project:

[adrianhajdin/award-winning-website](https://github.com/adrianhajdin/award-winning-website)

I fully respect the original author's work and sincerely appreciate the educational value of that project. It helped me learn modern frontend animation, scroll-based interaction, video-driven visual composition, and immersive homepage structure.

To be clear: **this project is not a completely original work at its current stage**. It is still a personal learning project that started from studying the original author's project and has been gradually modified, rebuilt, and improved with my own original ideas.

I am continuously moving this project toward a more original implementation while respecting the original author's effort. No matter how far this originality process goes in the future, even if it eventually becomes almost entirely my own implementation, I will not forget the help that open-source projects and high-quality tutorials have provided.

This repository is **not affiliated with, endorsed by, authorized by, or commercially connected to** the original author, the tutorial project, or Zentry. The reference is stated openly here for transparency and to avoid giving visitors the false impression that this homepage was created without any reference.

### Original And Customized Parts In This Project

I have made many original and site-specific changes around my own personal website identity, including but not limited to:

- A custom hero wallpaper selector based on a compass/avatar badge interaction.
- Personal site identity, wording, and content structure for `桃之夭夭`.
- A visual postcard-style scrolling About section.
- A gallery layout and archive-book page-flipping interaction for the Features section.
- Custom routing and integrations for Blog, Build Log, Bili Hub, AI assistant, and guestbook.
- Backend APIs for comments, AI context, Bili data caching, and related site functions.
- Engineering configuration for my own domain, UCloud server, and GitHub Actions deployment.

These original/customized parts were mainly completed through **vibecoding**: I defined requirements, made design decisions, evaluated results, and iterated continuously, while AI coding tools helped implement code and visual details.

The parts that were created, designed, organized, or iterated by me through vibecoding may be freely referenced, studied, and used, as long as this notice is respected.

However, for anything that may involve the original referenced project's design, structure, interaction ideas, or code origin, please do not treat this repository as the source of permission. Please go to the original author's project to review its own documentation, license, and usage boundaries.

### Non-Commercial Position

This project is used only for **personal learning, technical exploration, personal website deployment, and non-commercial technical communication**.

I will not sell this homepage as a template, package it as a commercial product, or use it for commercial profit. If any part of this project is considered inappropriate, too close to the referenced work, or unsuitable for public display, I am willing to keep revising, replacing, or removing it.

### Thanks

Thanks to the original author and the open-source/frontend learning community for providing high-quality learning resources. The growth of this project would not be possible without the inspiration brought by public projects, tutorials, and tools.
