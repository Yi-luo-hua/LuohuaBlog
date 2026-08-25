import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { rewriteAboutPreviewAssets } from "./aboutPreviewAssets.js";

test("rewrites direct COS URLs in the about preview to the same-origin proxy", () => {
  const html = `
    <img src="https://tzyy-1330068502.cos.ap-beijing.myqcloud.com/about-page/demo.jpg" alt="">
    <a href="https://tzyy-1330068502.cos.ap-beijing.myqcloud.com/about-page/demo.svg">asset</a>
    <span style="background-image:url('https://tzyy-1330068502.cos.ap-beijing.myqcloud.com/about-page/demo.webp')"></span>
  `;

  const rewritten = rewriteAboutPreviewAssets(html);

  assert.doesNotMatch(rewritten, /cos\.ap-beijing\.myqcloud\.com/);
  assert.match(rewritten, /src="\/cos\/about-page\/demo\.jpg"/);
  assert.match(rewritten, /href="\/cos\/about-page\/demo\.svg"/);
  assert.match(rewritten, /url\('\/cos\/about-page\/demo\.webp'\)/);
});

test("keeps the original about site thumbnails on the COS proxy", () => {
  const html = `
    <img src="/cos/about-page/20260624/sites-taozhiyy-3616e0f19f.jpg" alt="本站">
    <img src="/cos/about-page/20260624/sites-butterfly-3b2fb61396.jpg" alt="本站博客">
    <img src="/cos/about-page/20260624/sites-reimu-a3d1934027.jpg" alt="blog1-reimu.vercel.app">
    <img src="/cos/about-page/20260624/sites-tzyy11-41ead66835.jpg" alt="tzyy11.vercel.app">
  `;

  const rewritten = rewriteAboutPreviewAssets(html);

  assert.match(rewritten, /src="\/cos\/about-page\/20260624\/sites-taozhiyy-3616e0f19f\.jpg"/);
  assert.match(rewritten, /src="\/cos\/about-page\/20260624\/sites-butterfly-3b2fb61396\.jpg"/);
  assert.match(rewritten, /src="\/cos\/about-page\/20260624\/sites-reimu-a3d1934027\.jpg"/);
  assert.match(rewritten, /src="\/cos\/about-page\/20260624\/sites-tzyy11-41ead66835\.jpg"/);
  assert.doesNotMatch(rewritten, /\/img\/about-sites\//);
});

test("forces eager loading for every image to fix shadow DOM visibility", () => {
  const html = `
    <img class="cover" src="/cos/about-page/demo.jpg" alt="demo">
    <img loading="lazy" decoding="sync" src="/cos/about-page/hero.jpg" alt="hero">
  `;

  const rewritten = rewriteAboutPreviewAssets(html);

  assert.match(rewritten, /<img loading="eager" decoding="async" referrerpolicy="no-referrer" class="cover"/);
  assert.match(rewritten, /<img referrerpolicy="no-referrer" loading="eager" decoding="sync" src="\/cos\/about-page\/hero\.jpg"/);
});

test("forces eager loading for marquee tech-pill icons alongside other images", () => {
  const html = `
    <span class="tech-pill"><img class="ti" src="/cos/about-page/simpleicon-react.svg" alt=""/>React</span>
    <span class="tech-pill"><img class="ti ti-emoji" style="background:#fff">emoji</span>
    <img class="cover-img" src="/cos/about-page/cover.jpg" alt=""/>
  `;

  const rewritten = rewriteAboutPreviewAssets(html);

  assert.match(rewritten, /<img loading="eager" decoding="async" referrerpolicy="no-referrer" class="ti" src="\/cos\/about-page\/simpleicon-react\.svg"/);
  assert.match(rewritten, /<img loading="eager" decoding="async" referrerpolicy="no-referrer" class="cover-img"/);
});


test("strips inline onerror handlers and adds referrerpolicy for shadow DOM safety", () => {
  const html = `
    <img class="slot-image" src="/cos/about-page/game.jpg" alt="game" onerror="this.style.display='none'"/>
    <img class="slot-blur" src="/cos/about-page/game.jpg" alt="" onerror="this.style.display='none'"/>
  `;

  const rewritten = rewriteAboutPreviewAssets(html);

  assert.doesNotMatch(rewritten, /onerror/);
  assert.match(rewritten, /referrerpolicy="no-referrer"/);
});

test("keeps the original Genshin image visible instead of hiding it after a transient error", () => {
  const html = `
    <img loading="lazy" decoding="async" class="slot-image" src="/cos/about-page/20260624/games-genshin.jpg-card-4f646b6651.jpg" alt="原神" onerror="this.style.display='none'" />
  `;

  const rewritten = rewriteAboutPreviewAssets(html);

  assert.match(rewritten, /src="\/cos\/about-page\/20260624\/games-genshin\.jpg-card-4f646b6651\.jpg"/);
  assert.match(rewritten, /loading="eager"/);
  assert.match(rewritten, /referrerpolicy="no-referrer"/);
  assert.doesNotMatch(rewritten, /onerror/);
});

test("keeps the local Vite server aligned with the production COS proxy path", () => {
  const viteConfig = readFileSync(resolve("vite.config.js"), "utf8");

  assert.match(viteConfig, /["']\/cos["']\s*:/);

  // Production serves /cos/ from its own disk now, so dev must not reach for
  // the template author's bucket either — removing that dependency is the
  // whole point. No rewrite either: the path is identical on both sides.
  assert.doesNotMatch(viteConfig, /tzyy-1330068502/);
  assert.match(viteConfig, /VITE_COS_ORIGIN/);
});

test("renders the about route as a native React dashboard", () => {
  const routeSource = readFileSync(resolve("src/pages/AboutSitePage.jsx"), "utf8");

  assert.match(routeSource, /import \{ blogPosts \} from "virtual:blog-posts"/);
  assert.match(routeSource, /import \{ galleryAlbums \}/);
  assert.match(routeSource, /getBangumiCollection\("watching"\)/);
  assert.doesNotMatch(routeSource, /attachShadow|about-preview\.html/);
});

test("keeps the compact about dashboard links and real music player wired", () => {
  const routeSource = readFileSync(resolve("src/pages/AboutSitePage.jsx"), "utf8");

  assert.match(routeSource, /to="\/gallery"/);
  assert.match(routeSource, /to="\/bangumi\/watching"/);
  assert.match(routeSource, /import \{ FEATURED_PROJECT \} from "\.\.\/data\/featuredProject\.js"/);
  assert.match(routeSource, /href=\{FEATURED_PROJECT\.githubUrl\}/);
  assert.match(routeSource, /\{FEATURED_PROJECT\.name\}/);
  assert.match(routeSource, /target="_blank"/);
  assert.match(routeSource, /audio\/loop\.mp3/);
  assert.match(routeSource, /我的相册/);
  assert.match(routeSource, /番剧收藏/);
  assert.doesNotMatch(routeSource, /FiHeart|toggleLike|about-liked|about-like-count|data-physics-bubble="likes"/);
});

test("offers Pixiv and copyable email and QQ contacts in the social bubble", () => {
  const routeSource = readFileSync(resolve("src/pages/AboutSitePage.jsx"), "utf8");
  const styles = readFileSync(resolve("src/pages/AboutSitePage.css"), "utf8");
  const socialSource = routeSource.match(/<nav className="about-desk-social"[\s\S]*?<\/nav>/)?.[0] || "";

  assert.match(socialSource, /href="https:\/\/github\.com\/Yi-luo-hua"/);
  assert.match(socialSource, /href="https:\/\/space\.bilibili\.com\/313163065"/);
  assert.match(routeSource, /https:\/\/www\.pixiv\.net\/users\/42846132/);
  assert.match(routeSource, /akesakiko@gmail\.com/);
  assert.match(routeSource, /3043882857/);
  assert.match(routeSource, /copyTextToClipboard\(value\)/);
  assert.match(routeSource, /\$\{label\}已复制到剪贴板/);
  assert.match(routeSource, /role="status"/);
  assert.match(routeSource, /aria-live="polite"/);
  assert.doesNotMatch(routeSource, /<nav data-physics-bubble="social"/);
  assert.match(routeSource, /data-physics-bubble="github"/);
  assert.match(routeSource, /data-physics-bubble="bilibili"/);
  assert.doesNotMatch(routeSource, /data-physics-bubble="moments"/);
  assert.match(routeSource, /data-physics-bubble="pixiv"/);
  assert.match(routeSource, /data-physics-bubble="email"/);
  assert.match(routeSource, /data-physics-bubble="qq"/);
  assert.doesNotMatch(socialSource, /to="\/moments"/);
  assert.doesNotMatch(socialSource, />\s*(?:GitHub|Bilibili|Pixiv|邮箱|QQ)\s*</);
  assert.match(styles, /\.about-desk-social \.is-pixiv/);
  assert.match(styles, /\.about-desk-social-toast\.is-visible/);
});

test("stages the about bubbles with the reference-style pop sequence", () => {
  const styles = readFileSync(resolve("src/pages/AboutSitePage.css"), "utf8");

  assert.match(styles, /@keyframes about-desk-pop/);
  assert.match(styles, /scale\(\.6\)/);
  assert.match(styles, /nth-child\(11\)\s*\{\s*animation-delay:\s*\.84s/);
  assert.match(styles, /animation:\s*about-desk-pop[^;]+backwards/);
});

test("uses a seven-segment SVG clock and reference-sized interface icons", () => {
  const routeSource = readFileSync(resolve("src/pages/AboutSitePage.jsx"), "utf8");
  const styles = readFileSync(resolve("src/pages/AboutSitePage.css"), "utf8");

  assert.match(routeSource, /CLOCK_SEGMENTS/);
  assert.match(routeSource, /viewBox="0 0 29 52"/);
  assert.doesNotMatch(routeSource, /FiClock/);
  assert.match(styles, /\.about-desk-clock-digit\s*\{[\s\S]*?width:\s*29px;[\s\S]*?height:\s*52px;/);
  assert.match(styles, /\.about-desk-greeting span:first-child \{ font-size: 30px; \}/);
});

test("keeps the about greeting card down to a face and a hello", () => {
  const routeSource = readFileSync(resolve("src/pages/AboutSitePage.jsx"), "utf8");
  const styles = readFileSync(resolve("src/pages/AboutSitePage.css"), "utf8");

  // The nav, the six-way panel switcher and the facts/stack experiment are all
  // gone; the centre card is just the avatar disc and the greeting.
  assert.doesNotMatch(routeSource, /NAV_ITEMS|PANEL_CONTENT|activePanel/);
  assert.doesNotMatch(routeSource, /PROFILE_FACTS|TECH_STACK|PROFILE_TAGLINE/);
  assert.doesNotMatch(styles, /\.about-desk-nav\b|\.about-desk-facts|\.about-desk-stack/);

  assert.match(routeSource, /className="about-desk-greeting"/);
  assert.match(routeSource, /I&apos;m <b>\{OWNER_NAME\}<\/b>, Nice to meet you!/);
  assert.match(styles, /\.about-desk-profile-avatar \{[^}]*border-radius: 50%/);
});

test("greets by the time of day in the self-hosted handwriting face", () => {
  const routeSource = readFileSync(resolve("src/pages/AboutSitePage.jsx"), "utf8");
  const styles = readFileSync(resolve("src/pages/AboutSitePage.css"), "utf8");

  assert.match(routeSource, /const greetingFor = \(hour\) =>/);
  assert.match(routeSource, /"Good Morning"/);
  assert.match(routeSource, /"Good Evening"/);
  assert.match(routeSource, /greetingFor\(now\.getHours\(\)\)/);

  // Served from our own origin: the Google Fonts CDN is unreliable in China.
  assert.match(styles, /@font-face \{[\s\S]*?font-family: "Gochi Hand"/);
  assert.match(styles, /url\("\/fonts\/gochi-hand-latin\.woff2"\) format\("woff2"\)/);
  assert.doesNotMatch(styles, /fonts\.googleapis\.com|fonts\.gstatic\.com/);
  assert.match(styles, /\.about-desk-greeting \{[\s\S]*?font-family: "Gochi Hand"/);
});

test("shows real GitHub commits instead of a hand-written timeline", () => {
  const routeSource = readFileSync(resolve("src/pages/AboutSitePage.jsx"), "utf8");
  const apiSource = readFileSync(resolve("src/services/acgApi.js"), "utf8");
  const styles = readFileSync(resolve("src/pages/AboutSitePage.css"), "utf8");

  // The hard-coded milestone list is gone.
  assert.doesNotMatch(routeSource, /SITE_MILESTONES|SITE_BORN|daysSince/);

  // Commits come from our own cached endpoint, never straight from GitHub:
  // api.github.com allows 10 search requests/hour and is unreliable in China.
  assert.match(apiSource, /"\/api\/v1\/github\/commits"/);
  assert.doesNotMatch(routeSource, /api\.github\.com/);
  assert.doesNotMatch(apiSource, /api\.github\.com/);

  assert.match(routeSource, /getGithubCommits\(\)/);
  assert.match(routeSource, /const COMMIT_ROWS = \d/);
  // The commit search index silently omits whole repositories, so the card is
  // fed by per-repository reads instead.
  assert.doesNotMatch(apiSource, /search\/commits/);
  assert.match(styles, /\.about-desk-journey-list a \{[\s\S]*?-webkit-line-clamp: 2/);
});

test("keeps the commit card readable while loading or when the feed is down", () => {
  const routeSource = readFileSync(resolve("src/pages/AboutSitePage.jsx"), "utf8");

  // A failed fetch must not leave an empty box on the board.
  assert.match(routeSource, /state: "loading"/);
  assert.match(routeSource, /state: "error"/);
  assert.match(routeSource, /about-desk-journey-empty/);
  assert.match(routeSource, /正在读取提交记录/);
  assert.match(routeSource, /提交记录暂时取不到/);
});

test("formats commit times relative to now", () => {
  const routeSource = readFileSync(resolve("src/pages/AboutSitePage.jsx"), "utf8");

  assert.match(routeSource, /const relativeCommitTime = \(isoDate, now\) =>/);
  assert.match(routeSource, /"刚刚"/);
  assert.match(routeSource, /"昨天"/);
  assert.match(routeSource, /const shortRepoName =/);
});

test("wires every desktop bubble into the elastic drag physics layer", () => {
  const routeSource = readFileSync(resolve("src/pages/AboutSitePage.jsx"), "utf8");
  const physicsSource = readFileSync(resolve("src/pages/useBubblePhysics.js"), "utf8");
  const styles = readFileSync(resolve("src/pages/AboutSitePage.css"), "utf8");

  assert.equal((routeSource.match(/data-physics-bubble=/g) || []).length, 14);
  assert.match(routeSource, /useBubblePhysics\(physicsContainerRef\)/);
  assert.match(physicsSource, /import\("matter-js"\)/);
  assert.match(physicsSource, /Bodies\.rectangle/);
  assert.match(physicsSource, /Body\.setVelocity/);
  assert.match(physicsSource, /DRAG_PUSH_STIFFNESS/);
  assert.match(physicsSource, /DRAG_PUSH_CLEARANCE\s*=\s*16/);
  assert.match(physicsSource, /layoutOffsetWithin\(element, container\)/);
  assert.match(physicsSource, /\(min-width: 1200px\)/);
  assert.match(physicsSource, /prefers-reduced-motion: reduce/);
  assert.match(styles, /translate:\s*var\(--physics-x[^;]+var\(--physics-y/);
  assert.match(styles, /@media \(min-width: 1400px\)[\s\S]*?width:\s*min\(100%,\s*1380px\)/);
});

test("shrinks bubbles on hover and springs them back after pressing", () => {
  const styles = readFileSync(resolve("src/pages/AboutSitePage.css"), "utf8");

  assert.match(styles, /\[data-physics-bubble\]:hover[\s\S]*?scale:\s*\.96/);
  assert.match(styles, /\[data-physics-bubble\]:active[\s\S]*?scale:\s*\.9/);
  assert.match(styles, /transition:\s*scale 360ms cubic-bezier\(\.2, 1\.45, \.35, 1\)/);
  assert.match(styles, /prefers-reduced-motion:\s*reduce[\s\S]*?\[data-physics-bubble\]:active\s*\{\s*scale:\s*1/);
});

test("drags a bubble under the cursor rather than snapping it to the centre", () => {
  const physicsSource = readFileSync(resolve("src/pages/useBubblePhysics.js"), "utf8");

  // Pointer coordinates are screen pixels, the simulation runs in layout pixels.
  assert.match(physicsSource, /viewportScale = containerRect\.width \/ width/);
  assert.match(physicsSource, /const pointerToWorld = \(event\) => \(\{/);
  assert.match(physicsSource, /drag\.grabX = body\.position\.x - grabbed\.x/);
  // The container rect goes stale as soon as the page scrolls.
  assert.match(physicsSource, /refreshViewportMetrics\(\);/);
  assert.match(physicsSource, /addEventListener\("scroll", refreshViewportMetrics/);
  // Collision boxes use layout offsets, including nested social bubbles, and
  // must not pick up the resting tilt or the fit scale.
  assert.match(physicsSource, /const layoutOffset = layoutOffsetWithin\(element, container\)/);
  assert.match(physicsSource, /layoutOffset\.left \+ visualWidth \/ 2/);
  assert.doesNotMatch(physicsSource, /element\.getBoundingClientRect\(\)/);
});

test("settles every bubble back onto its authored coordinates", () => {
  const physicsSource = readFileSync(resolve("src/pages/useBubblePhysics.js"), "utf8");

  assert.match(physicsSource, /ANCHOR_STIFFNESS\s*=\s*0\.075/);
  assert.match(physicsSource, /collisionFilter: \{ group: -1 \}/);
  assert.match(physicsSource, /Body\.setPosition\(record\.body, \{ x: record\.anchor\.x/);
  // Releasing a card must not re-anchor it where it was dropped.
  assert.doesNotMatch(physicsSource, /record\.anchor\.x = body\.position\.x/);
  // No all-pairs spring: nothing pushes while the constellation is at rest.
  assert.doesNotMatch(physicsSource, /restingDistance/);
  assert.match(physicsSource, /if \(activeDrags === 0\) return displaced;/);
});

test("shrinks the desktop constellation until it fits one screen", () => {
  const routeSource = readFileSync(resolve("src/pages/AboutSitePage.jsx"), "utf8");
  const fitSource = readFileSync(resolve("src/pages/useConstellationFit.js"), "utf8");
  const styles = readFileSync(resolve("src/pages/AboutSitePage.css"), "utf8");

  assert.match(routeSource, /useConstellationFit\(pageRef, physicsContainerRef\)/);
  assert.match(routeSource, /<main ref=\{pageRef\} className="about-desk-page"/);
  assert.match(fitSource, /page\.style\.setProperty\("--about-fit"/);
  assert.match(fitSource, /page\.style\.setProperty\("--about-footer"/);
  assert.match(styles, /transform:\s*scale\(var\(--about-fit, 1\)\)/);
  assert.match(
    styles,
    /margin-bottom:\s*calc\(var\(--about-design-height\) \* \(var\(--about-fit, 1\) - 1\)\)/,
  );
  // The page fills the viewport on its own, so it has to hand the footer its room back.
  assert.match(styles, /min-height:\s*calc\(100dvh - var\(--about-footer, 0px\)\)/);
});

test("about preview source eagerly loads image assets without hiding failed Genshin images", () => {
  const previewHtml = readFileSync(resolve("public/about-preview.html"), "utf8");

  assert.doesNotMatch(previewHtml, /loading="lazy"/);
  assert.doesNotMatch(previewHtml, /onerror="this\.style\.display='none'"/);
  assert.match(previewHtml, /simpleicon-react-61dafb-7c601a5c00\.svg/);
  assert.match(previewHtml, /games-genshin\.jpg-card-4f646b6651\.jpg/);
});
