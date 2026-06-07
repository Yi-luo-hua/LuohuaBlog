# Taozhiyy Monorepo / 桃之夭夭 Monorepo

[中文说明](./README.zh-CN.md) | English

This is the monorepo for my personal website `Taozhiyy / 桃之夭夭`, including the main site, build-log subsite, Hexo blog, shared AI assistant scripts, and backend API.

## Project Structure

- `main/`: Main frontend site, built with React, Vite, Tailwind CSS, and GSAP.
- `build/`: Build-log subsite for recording how this website is built and iterated.
- `blog/`: Hexo + Butterfly blog.
- `acg-api/`: Go backend API, including guestbook, AI assistant, Bili Hub cache sync, and related features.
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
- Custom routing and integrations for Blog, Build Log, Bili Hub, AI assistant, and guestbook.
- Backend APIs for comments, AI context, Bili data caching, and related site functions.
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

### `acg-api/` Backend And API

The backend and API calling logic were mainly completed with the help of **vibecoding**, including guestbook, AI assistant context, Bili Hub data cache sync, and related functions.

Concretely, `acg-api` is the Go service layer behind the site's `/api` routes. It handles public features such as guestbook submissions, AI assistant context/statistics, Bili Hub cache sync, and health checks, plus owner-only workflows such as owner authentication/session checks, unread message inbox and read markers, AI registered-user inspection, publishing build/blog content, friend links/gallery URLs, and COS-backed image uploads.

Data is persisted mainly through SQLite and server runtime files. Write actions that touch GitHub, COS, or AI services require private environment variables on the deployment machine. This repository may expose route names, source code structure, and environment variable names, but it is not intended to include my owner login password, verification answer, GitHub token, COS secret, AI key, server credentials, or private database. Anyone cloning this project must provide their own credentials, verification information, database, deployment host, and external service configuration.

If you want to reference or reuse the backend logic, please read, verify, and test it first to make sure it fits your own use case.

Environment variables, secrets, server addresses, database settings, and external service configurations must be prepared and configured by yourself. This repository does not provide private environment variables that can be reused directly.

If you find any problem while reading, using, or deploying this project, or if you have any suggestions, you are welcome to contact me.

## Non-Commercial Position

This project is used only for **personal learning, technical exploration, personal website deployment, and non-commercial technical communication**.

I will not sell this homepage as a template, package it as a commercial product, or use it for commercial profit. If any part of this project is considered inappropriate, too close to the referenced work, or unsuitable for public display, I am willing to keep revising, replacing, or removing it.

## Thanks

Thanks to the original author and the open-source/frontend learning community for providing high-quality learning resources. The growth of this project would not be possible without the inspiration brought by public projects, tutorials, and tools.
