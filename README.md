# Taozhiyy Monorepo

桃之夭夭个人网站的 monorepo，包含主站、成长博客子站、Hexo 博客、共享 AI 助手脚本和后端 API。

## Project Structure

- `main/`: 主站前端，基于 React、Vite、Tailwind CSS 和 GSAP。
- `build/`: 成长博客子站，用于记录本站从搭建到迭代的过程。
- `blog/`: Hexo + Butterfly 博客。
- `acg-api/`: Go 后端 API，包含留言板、AI 助手、Bili Hub 缓存同步等功能。
- `shared/`: 多个站点共用的脚本与样式，例如右下角 AI 助手。
- `deploy/`: 部署相关脚本。
- `.github/workflows/`: GitHub Actions 自动部署配置。

## Homepage Reference Notice

The early version of the homepage was built while learning from the tutorial project:

[adrianhajdin/award-winning-website](https://github.com/adrianhajdin/award-winning-website)

That project is a great educational resource. This repository is a personal learning and portfolio project, and it is not affiliated with or endorsed by the original tutorial author or Zentry.

Because the referenced repository does not appear to provide an explicit open-source license, the homepage in this repository is being progressively customized and rewritten with personal materials, personal copy, and site-specific features. The goal is to keep the learning value of the animation and interaction ideas while moving the final public website toward an original implementation.

Attribution does not imply permission from the original project. If any part of this site is found to be inappropriate or too close to the referenced work, I will revise or remove it.

## Current Direction

- Replace tutorial-style assets with personal or properly licensed materials.
- Keep only general interaction ideas, such as scroll animation, video transitions, and immersive layout patterns.
- Gradually redesign the homepage visual language so it better matches the Taozhiyy site identity.
- Keep the build log transparent so visitors can see how the site evolves.

## Notes

This repository is primarily for personal learning, experimentation, and deployment of my own website. Please do not treat the homepage reference as a claim of ownership over the original tutorial design.
