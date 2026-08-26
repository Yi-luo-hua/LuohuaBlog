import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readSource = (path) => readFileSync(resolve(sourceRoot, path), "utf8");

test("labels the former moments route as the blog in the top navbar", () => {
  const navbarSource = readSource("components/Navbar.jsx");

  assert.match(navbarSource, /\{\s*label:\s*"博客",\s*to:\s*"\/moments"/);
});

test("keeps the about entry in the top navbar", () => {
  const navbarSource = readSource("components/Navbar.jsx");

  assert.match(navbarSource, /\{\s*label:\s*"关于我",\s*to:\s*"\/about"/);
});

test("omits gallery and Bangumi from the top navbar only", () => {
  const navbarSource = readSource("components/Navbar.jsx");
  const navLinksSource = navbarSource.match(/const navLinks = \[([\s\S]*?)\];/)?.[1] || "";

  assert.doesNotMatch(navLinksSource, /相册集|BANGUMI|\/gallery|\/bangumi/);
  assert.match(navbarSource, /pathname\.startsWith\("\/gallery\/"\)/);
  assert.match(navbarSource, /pathname\.startsWith\("\/bangumi\/"\)/);
});

test("registers the about page and project child route", () => {
  const appSource = readSource("App.jsx");

  assert.match(appSource, /path="about"/);
  assert.match(appSource, /path="about\/projects\/:projectId"/);
});

test("keeps the about preview production-safe", () => {
  const aboutPreviewSource = readSource("../public/about-preview.html");

  assert.doesNotMatch(aboutPreviewSource, /预览专用|Preview only/i);
  assert.doesNotMatch(aboutPreviewSource, /cos\.ap-beijing\.myqcloud\.com/);
  assert.match(aboutPreviewSource, /\/cos\/about-page\/20260624\//);
  assert.match(aboutPreviewSource, /href="\/showcase\/quizcard\.html"/);
  assert.doesNotMatch(aboutPreviewSource, /\/about\/projects\/quizcard/);
});

test("keeps the quizcard project page on the deployed showcase page", () => {
  const projectPageSource = readSource("pages/AboutProjectPage.jsx");

  assert.match(projectPageSource, /showcase\/quizcard\.html/);
  assert.doesNotMatch(
    projectPageSource,
    /Project Notes|回到项目集|localPreview|127\.0\.0\.1|localhost/i,
  );
});

test("ships the quizcard showcase page and its local assets", () => {
  const showcasePath = "../public/showcase/quizcard.html";
  assert.equal(existsSync(resolve(sourceRoot, showcasePath)), true);

  const showcaseSource = readSource(showcasePath);
  assert.match(showcaseSource, /assets\/showcase\.css/);
  assert.match(showcaseSource, /assets\/showcase\.js/);
  assert.match(showcaseSource, /mp-pages\/login\.html/);
  assert.match(showcaseSource, /\.\.\/web\/index\.html/);
});

test("ships the quizcard visitor app with seed data and all required modules", () => {
  const requiredWebFiles = [
    "../public/web/index.html",
    "../public/web/create.html",
    "../public/web/history.html",
    "../public/web/practice-setup.html",
    "../public/web/practice.html",
    "../public/web/report.html",
    "../public/web/settings.html",
    "../public/web/login.html",
    "../public/web/assets/store.js",
    "../public/web/assets/seed.js",
    "../public/web/assets/shell.js",
    "../public/web/assets/parser.js",
    "../public/web/assets/auth.js",
    "../public/web/assets/settings.js",
    "../public/web/assets/style.css",
  ];

  for (const filePath of requiredWebFiles) {
    assert.equal(
      existsSync(resolve(sourceRoot, filePath)),
      true,
      `${filePath} should be deployed`,
    );
  }

  const storeSource = readSource("../public/web/assets/store.js");
  const seedSource = readSource("../public/web/assets/seed.js");
  const guestPages = [
    "../public/web/index.html",
    "../public/web/create.html",
    "../public/web/history.html",
    "../public/web/practice-setup.html",
    "../public/web/practice.html",
    "../public/web/report.html",
    "../public/web/settings.html",
  ];

  assert.match(storeSource, /from ['"]\.\/seed\.js['"]/);
  assert.match(storeSource, /ensureSeed/);
  assert.match(seedSource, /export const SEED/);
  for (const deckId of [
    "deck_seed_neuro",
    "deck_seed_vocab",
    "deck_seed_physics",
  ]) {
    assert.match(seedSource, new RegExp(deckId));
  }

  for (const pagePath of guestPages) {
    const pageSource = readSource(pagePath);
    assert.match(pageSource, /mountShell\([^;]*requireAuth:\s*false[^;]*\)/s);
  }
});

test("keeps the about projects grid roomy in the integrated site", () => {
  const aboutPreviewSource = readSource("../public/about-preview.html");

  assert.match(aboutPreviewSource, /\.page\s*\{\s*max-width:\s*14[0-9]{2}px/);
  assert.match(
    aboutPreviewSource,
    /@media \(min-width:\s*1024px\)\s*\{\s*\.projects\s*\{\s*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/,
  );
  assert.match(
    aboutPreviewSource,
    /@media \(min-width:\s*14[0-9]{2}px\)\s*\{\s*\.projects\s*\{\s*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/,
  );
});

test("keeps about, moments, and friends mobile drawer navigation on their page palettes", () => {
  const cssSource = readSource("index.css");

  for (const theme of ["about", "moments", "friends"]) {
    assert.match(cssSource, new RegExp(`\\.nav-mobile-backdrop--${theme}`));
    assert.match(
      cssSource,
      new RegExp(`\\.nav-mobile-drawer--${theme}\\s*\\{`),
    );
    assert.match(
      cssSource,
      new RegExp(`\\.nav-mobile-drawer--${theme} \\.nav-mobile-drawer-head`),
    );
    assert.match(
      cssSource,
      new RegExp(`\\.nav-mobile-drawer--${theme} \\.nav-mobile-close`),
    );
    assert.match(cssSource, new RegExp(`\\.nav-mobile-link--${theme}`));
    assert.match(cssSource, new RegExp(`\\.nav-mobile-link--active-${theme}`));
    assert.match(cssSource, new RegExp(`\\.nav-menu-btn--${theme}`));
  }
});

test("keeps the about game cards compact and fully visible on phones", () => {
  const aboutPreviewSource = readSource("../public/about-preview.html");
  const mobileGameBlock = aboutPreviewSource.match(
    /@media \(max-width:\s*540px\)\s*\{(?<rules>[\s\S]*?)\/\* ============ 5\./,
  );

  assert.ok(mobileGameBlock, "missing mobile game card rules");

  assert.match(
    aboutPreviewSource,
    /@media \(max-width:\s*540px\)\s*\{[\s\S]*?\.game-shelf-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/,
  );
  assert.doesNotMatch(mobileGameBlock.groups.rules, /grid-column:\s*1 \/ -1/);
  assert.match(
    aboutPreviewSource,
    /@media \(max-width:\s*540px\)\s*\{[\s\S]*?\.game-slot\s*\{[\s\S]*?border-radius:\s*0\.85rem/,
  );
  assert.match(
    aboutPreviewSource,
    /@media \(max-width:\s*540px\)\s*\{[\s\S]*?\.game-slot\s*\{[\s\S]*?aspect-ratio:\s*9 \/ 13/,
  );
});

test("keeps the quizcard showcase bounded on phone width", () => {
  const showcaseSource = readSource("../public/showcase/quizcard.html");
  const showcaseCss = readSource("../public/showcase/assets/showcase.css");
  const quizcardCss = readSource("../public/web/assets/style.css");
  const shellSource = readSource("../public/web/assets/shell.js");

  assert.match(showcaseSource, /src="\.\.\/web\/index\.html\?embed=showcase"/);
  assert.match(shellSource, /embed-showcase/);

  assert.match(
    showcaseCss,
    /@media \(max-width:\s*640px\)\s*\{[\s\S]*?\.tg-page\s*\{[\s\S]*?padding:\s*48px 14px 72px/,
  );
  assert.match(
    showcaseCss,
    /@media \(max-width:\s*640px\)\s*\{[\s\S]*?\.tg-demo\s*\{[\s\S]*?gap:\s*18px/,
  );
  assert.match(
    showcaseCss,
    /@media \(max-width:\s*640px\)\s*\{[\s\S]*?\.tg-demo-pc \.frame\s*\{[\s\S]*?height:\s*min\(560px,\s*118vw\)/,
  );
  assert.match(
    showcaseCss,
    /@media \(max-width:\s*640px\)\s*\{[\s\S]*?\.iphone\s*\{[\s\S]*?width:\s*min\(100%,\s*260px\)/,
  );
  assert.match(
    quizcardCss,
    /html\.embed-showcase \.nav-mobile\s*\{[\s\S]*?display:\s*none\s*!important/,
  );
  assert.match(
    quizcardCss,
    /html\.embed-showcase \.page\s*\{[\s\S]*?padding:\s*64px 12px 18px/,
  );
  assert.match(
    quizcardCss,
    /@media \(max-width:\s*520px\)\s*\{[\s\S]*?\.page\s*\{[\s\S]*?padding:\s*68px 12px calc\(env\(safe-area-inset-bottom,\s*0\) \+ 88px\)/,
  );
  assert.match(
    quizcardCss,
    /@media \(max-width:\s*520px\)\s*\{[\s\S]*?\.deck-card\s*\{[\s\S]*?padding:\s*14px/,
  );
  assert.match(
    quizcardCss,
    /@media \(max-width:\s*520px\)\s*\{[\s\S]*?\.deck-card \.footer\s*\{[\s\S]*?align-items:\s*stretch/,
  );
});

test("animates the bangumi shelf entrance on compositor-only properties", () => {
  const cssSource = readSource("index.css");
  const shelfSource = readSource("components/BangumiShelf.jsx");
  const keyframes = cssSource
    .split("@keyframes bangumiCardRipple")[1]
    .split(".bangumi-card-ripple")[0];

  // opacity and transform are composited on the GPU; a blur has to
  // re-rasterise the card every frame, and an animated radius cannot be
  // cached. That one property is what made the entrance stutter.
  assert.doesNotMatch(keyframes, /filter\s*:/);
  assert.match(keyframes, /opacity\s*:/);
  assert.match(keyframes, /transform\s*:/);
  assert.doesNotMatch(cssSource, /will-change:\s*filter/);

  // The card surface sits on a flat page background, so its backdrop-filter
  // blurred nothing visible while costing a backdrop re-sample per card. The
  // badges over the cover art keep theirs.
  const cardSurface = shelfSource.slice(
    shelfSource.indexOf("<article"),
    shelfSource.indexOf("<article") + 400,
  );
  assert.doesNotMatch(cardSurface, /backdrop-blur/);
});

test("keeps quizcard settings actions safe for visitors", () => {
  const settingsSource = readSource("../public/web/settings.html");

  assert.match(settingsSource, /const accountLabel = u \? u\.email : 'guest';/);
  assert.match(settingsSource, /const accountId = u \? u\.id : 'guest';/);
  assert.doesNotMatch(settingsSource, /quizcard-backup-\$\{u\.email\}/);
  assert.doesNotMatch(
    settingsSource,
    /localStorage\.removeItem\('quizcard\.' \+ u\.id \+ '\.usage'\)/,
  );
});

test("renders the blog showcase on the former moments route", () => {
  const momentsPageSource = readSource("pages/MomentsPage.jsx");

  assert.match(momentsPageSource, /from "virtual:blog-posts"/);
  assert.match(momentsPageSource, /文章与<span>札记<\/span>/);
  assert.match(momentsPageSource, /className="blog-showcase-layout"/);
  assert.match(momentsPageSource, /className="blog-post-grid"/);
  assert.match(momentsPageSource, /className="blog-sidebar"/);
});

test("supports searching and filtering the blog source posts", () => {
  const momentsPageSource = readSource("pages/MomentsPage.jsx");

  assert.match(momentsPageSource, /type="search"/);
  assert.match(momentsPageSource, /setQuery\(event\.target\.value\)/);
  assert.match(momentsPageSource, /post\.tags\.includes\(activeTag\)/);
  assert.match(momentsPageSource, /setActiveTag\(tag\)/);
});

test("styles the blog showcase responsively", () => {
  const cssSource = readSource("index.css");

  assert.match(cssSource, /\.blog-showcase-page\s*\{/);
  assert.match(cssSource, /\.blog-lead-card\s*\{/);
  assert.match(cssSource, /\.blog-post-card\s*\{/);
  assert.match(cssSource, /@media \(max-width:\s*1080px\)/);
  assert.match(cssSource, /@media \(max-width:\s*760px\)/);
});

test("does not put the moments entry in feature five", () => {
  const featuresSource = readSource("components/Features.jsx");

  assert.doesNotMatch(featuresSource, /to="\/moments"/);
  assert.doesNotMatch(featuresSource, /说说入口|碎语入口|进入碎语|进入碎碎念/);
});

test("dresses the four bento cards in our own images, not the template's videos", () => {
  const featuresSource = readSource("components/Features.jsx");
  // 只看 bento 网格那一段。上面的 ARCHIVE_ITEMS 仍在用模板作者的影像档案视频，
  // 那是另一处入口，不在这条断言的范围里。
  const bentoGrid = featuresSource.slice(featuresSource.indexOf("features-bento-grid"));
  assert.ok(bentoGrid.length > 0);

  // 四张卡片原本铺的是模板作者 COS 目录下的 feature-2..5.mp4。
  for (const clip of ["feature-2.mp4", "feature-3.mp4", "feature-5.mp4"]) {
    assert.ok(
      !bentoGrid.includes("videos/" + clip),
      "bento card still points at " + clip,
    );
  }

  for (const image of ["bento-bangumi.jpg", "bento-wide.jpg", "bento-about.jpg"]) {
    assert.ok(
      bentoGrid.includes("${BENTO}/" + image),
      "missing bento image " + image,
    );
  }

  // 关于我那张是竖图裁出来的头部特写，靠上对齐才不会把脸切掉。
  const aboutAt = featuresSource.indexOf("bento-about.jpg");
  assert.ok(aboutAt > 0);
  assert.ok(
    featuresSource.slice(aboutAt, aboutAt + 120).includes('objectPosition="object-top"'),
    "the about card must pin its crop to the top",
  );
});

test("keeps the Misaka showcase fixed above four real homepage destinations", () => {
  const featuresSource = readSource("components/Features.jsx");
  const featuredProjectSource = readSource("data/featuredProject.js");
  const cssSource = readSource("index.css");

  assert.match(
    featuresSource,
    /src="\/media\/feature-misaka-full-loop\.mp4"[\s\S]*?poster="\/media\/feature-misaka-full-loop\.webp"[\s\S]*?visualOnly/,
  );
  assert.doesNotMatch(featuresSource, /御坂美琴 · 固定放映/);

  for (const [title, href] of [
    ["相册集", "/gallery"],
    ["番剧收藏", "/bangumi"],
    ["关于我", "/about"],
  ]) {
    assert.match(
      featuresSource,
      new RegExp(`title="${title}"[\\s\\S]*?linkUrl="${href}"`),
    );
  }

  assert.match(featuresSource, /import \{ FEATURED_PROJECT \} from "\.\.\/data\/featuredProject\.js"/);
  assert.match(featuresSource, /title=\{FEATURED_PROJECT\.name\}/);
  assert.match(featuresSource, /linkUrl=\{FEATURED_PROJECT\.githubUrl\}/);
  assert.match(featuredProjectSource, /name:\s*"BilibiliCrawler"/);
  assert.match(featuredProjectSource, /githubUrl:\s*"https:\/\/github\.com\/Yi-luo-hua\/BilibiliCrawler"/);

  assert.doesNotMatch(featuresSource, /伊洛华的收藏室|去看看，|我留下的世界/);
  assert.match(featuresSource, /container mx-auto px-3 pt-8 md:px-10 md:pt-10/);
  assert.match(
    featuresSource,
    /md:grid-rows-\[16rem_16rem_18rem\][\s\S]*?lg:grid-rows-\[18rem_18rem_20rem\]/,
  );
  assert.doesNotMatch(featuresSource, /md:h-\[145vh\]|h-\[24rem\]/);
  assert.equal(
    featuresSource.match(/bento-tilt_1[^"\n]*md:col-span-1/g)?.length,
    3,
    "the three upper destination cards should occupy one desktop column each",
  );
  assert.doesNotMatch(
    cssSource,
    /\.bento-tilt_1\s*\{[^}]*col-span-2/s,
    "the shared card class must not force every destination to span both columns",
  );
  assert.ok(
    featuresSource.indexOf('title="番剧收藏"') <
      featuresSource.indexOf('title="相册集"'),
    "the compact bento should begin with the anime collection",
  );
  assert.doesNotMatch(
    featuresSource,
    /Selected fragments|Things worth remembering|More coming soon|Feature Five/i,
  );
});

test("keeps the original homepage sections instead of embedding the blog showcase", () => {
  const homePageSource = readSource("pages/HomePage.jsx");

  assert.match(homePageSource, /<Hero \/>/);
  assert.match(homePageSource, /<About \/>/);
  assert.match(homePageSource, /<Features \/>/);
  assert.doesNotMatch(homePageSource, /BlogShowcasePage|blog-showcase-page/);
});

test("links the homepage reveal card to the latest blog post", () => {
  const aboutSource = readSource("components/About.jsx");

  assert.match(aboutSource, /from "virtual:blog-posts"/);
  assert.match(aboutSource, /right\.date\.localeCompare\(left\.date\)/);
  assert.match(aboutSource, /href=\{latestPost\.url\}/);
  assert.match(
    aboutSource,
    /src=\{latestPost\.cover \|\| fallbackPost\.cover\}/,
  );
  assert.match(aboutSource, /\{latestPost\.title\}/);
  assert.doesNotMatch(
    aboutSource,
    /FEEL FREE|SCROLLING DOWN|Welcome to|Scroll to immerse|Here are more of my creations/i,
  );
});

test("themes the footer only for pages that still exist", () => {
  const footerSource = readSource("components/Footer.jsx");

  assert.match(footerSource, /moments:\s*\{/);
  assert.match(footerSource, /pathname\.startsWith\("\/moments"\)/);
  assert.match(footerSource, /pathname\.startsWith\("\/bangumi"\)/);

  // /friends and /ai-traffic are gone, so their palettes could never be
  // selected — a branch that can never be taken is just a wrong map of the site.
  assert.doesNotMatch(footerSource, /friends:\s*\{|ai:\s*\{/);
  assert.doesNotMatch(footerSource, /"\/friends"|"\/ai-traffic"/);
});

test("keeps quizcard report summary card from overlaying reviews on narrow screens", () => {
  const reportSource = readSource("../public/web/report.html");
  const baseStyles = reportSource.split("@media (min-width: 880px)")[0];

  assert.match(reportSource, /\.summary-card\s*\{/);
  assert.doesNotMatch(baseStyles, /position:\s*sticky/);
  assert.match(
    reportSource,
    /@media \(min-width:\s*880px\)\s*\{[\s\S]*?\.summary-card\s*\{[\s\S]*?position:\s*sticky;[\s\S]*?top:\s*88px;[\s\S]*?\}/,
  );
});
