import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readSource = (path) => readFileSync(resolve(sourceRoot, path), "utf8");

test("keeps the moments entry in the top navbar", () => {
  const navbarSource = readSource("components/Navbar.jsx");

  assert.match(navbarSource, /\{\s*label:\s*"碎语",\s*to:\s*"\/moments"/);
});

test("keeps the about entry in the top navbar", () => {
  const navbarSource = readSource("components/Navbar.jsx");

  assert.match(navbarSource, /\{\s*label:\s*"关于我",\s*to:\s*"\/about"/);
});

test("registers the about page and project child route", () => {
  const appSource = readSource("App.jsx");

  assert.match(appSource, /path="about"/);
  assert.match(appSource, /path="about\/projects\/:projectId"/);
});

test("keeps the about preview production-safe", () => {
  const aboutPreviewSource = readSource("../public/about-preview.html");

  assert.doesNotMatch(aboutPreviewSource, /预览专用|Preview only/i);
  assert.doesNotMatch(aboutPreviewSource, /taozhiyy\.top\/cos/);
  assert.match(aboutPreviewSource, /tzyy-1330068502\.cos\.ap-beijing\.myqcloud\.com/);
  assert.match(aboutPreviewSource, /href="\/showcase\/quizcard\.html"/);
  assert.doesNotMatch(aboutPreviewSource, /\/about\/projects\/quizcard/);
});

test("keeps the quizcard project page on the deployed showcase page", () => {
  const projectPageSource = readSource("pages/AboutProjectPage.jsx");

  assert.match(projectPageSource, /showcase\/quizcard\.html/);
  assert.doesNotMatch(projectPageSource, /Project Notes|回到项目集|localPreview|127\.0\.0\.1|localhost/i);
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
    assert.equal(existsSync(resolve(sourceRoot, filePath)), true, `${filePath} should be deployed`);
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
  for (const deckId of ["deck_seed_neuro", "deck_seed_vocab", "deck_seed_physics"]) {
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
  assert.match(aboutPreviewSource, /@media \(min-width:\s*1024px\)\s*\{\s*\.projects\s*\{\s*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(aboutPreviewSource, /@media \(min-width:\s*14[0-9]{2}px\)\s*\{\s*\.projects\s*\{\s*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
});

test("keeps quizcard settings actions safe for visitors", () => {
  const settingsSource = readSource("../public/web/settings.html");

  assert.match(settingsSource, /const accountLabel = u \? u\.email : 'guest';/);
  assert.match(settingsSource, /const accountId = u \? u\.id : 'guest';/);
  assert.doesNotMatch(settingsSource, /quizcard-backup-\$\{u\.email\}/);
  assert.doesNotMatch(settingsSource, /localStorage\.removeItem\('quizcard\.' \+ u\.id \+ '\.usage'\)/);
});

test("names the moments page 碎语", () => {
  const momentsPageSource = readSource("pages/MomentsPage.jsx");

  assert.match(momentsPageSource, /<h1>碎语<\/h1>/);
  assert.match(
    momentsPageSource,
    /<p className="moments-page-subtitle">过往的点点滴滴，且随风而去吧<\/p>/
  );
  assert.doesNotMatch(momentsPageSource, /<h1>说说<\/h1>/);
});

test("renders moments with varied visual modules", () => {
  const momentsPageSource = readSource("pages/MomentsPage.jsx");
  const cssSource = readSource("index.css");

  assert.match(momentsPageSource, /moments-module--\$\{moment\.module\}/);
  for (const module of ["photo", "postcard", "ticket", "watercolor", "poem", "journal", "ribbon"]) {
    assert.match(cssSource, new RegExp(`\\.moments-module--${module}`));
  }
});

test("keeps varied moments modules in one balanced multicolor holographic card family", () => {
  const cssSource = readSource("index.css");
  const moduleNames = ["photo", "postcard", "ticket", "watercolor", "poem", "journal", "ribbon"];
  const toneNames = ["rainbow", "aurora", "ticket", "watercolor", "mist", "journal", "mint"];

  assert.match(cssSource, /--moment-holo:/);
  assert.match(cssSource, /--moment-holo-mint:/);
  assert.match(cssSource, /--moment-holo-blue:/);
  assert.match(cssSource, /--moment-holo-sun:/);
  assert.match(cssSource, /--moment-holo-lavender:/);
  assert.match(cssSource, /--moment-holo-rainbow:/);

  for (const module of moduleNames) {
    const moduleBlock = cssSource.match(
      new RegExp(`\\.moments-module--${module} \\{(?<rules>[\\s\\S]*?)\\n\\}`)
    );

    assert.ok(moduleBlock, `missing CSS block for ${module}`);
    assert.doesNotMatch(moduleBlock.groups.rules, /--moment-width|--moment-margin-left|--moment-margin-right/);
  }

  for (const tone of toneNames) {
    const toneBlock = cssSource.match(
      new RegExp(`\\.moments-card--${tone} \\{(?<rules>[\\s\\S]*?)\\n\\}`)
    );

    assert.ok(toneBlock, `missing tone CSS block for ${tone}`);
    assert.match(toneBlock.groups.rules, /--moment-holo:\s*var\(--moment-holo-/);
    assert.match(toneBlock.groups.rules, /--moment-accent:/);
  }
});

test("renders optional moment images as safe React image elements", () => {
  const momentsPageSource = readSource("pages/MomentsPage.jsx");
  const cssSource = readSource("index.css");
  const photoBlock = cssSource.match(/\.moments-photo \{(?<rules>[\s\S]*?)\n\}/);

  assert.match(momentsPageSource, /\{moment\.image && \(/);
  assert.match(momentsPageSource, /src=\{moment\.image\.src\}/);
  assert.match(momentsPageSource, /alt=\{moment\.image\.alt\}/);
  assert.match(momentsPageSource, /loading="lazy"/);
  assert.match(cssSource, /\.moments-photo/);
  assert.ok(photoBlock, "missing moments photo CSS block");
  assert.match(photoBlock.groups.rules, /width:\s*clamp\(5\.2rem,\s*15vw,\s*6\.6rem\)/);
  assert.doesNotMatch(photoBlock.groups.rules, /30rem|100%/);
});

test("does not put the moments entry in feature five", () => {
  const featuresSource = readSource("components/Features.jsx");

  assert.doesNotMatch(featuresSource, /to="\/moments"/);
  assert.doesNotMatch(featuresSource, /说说入口|碎语入口|进入碎语|进入碎碎念/);
});

test("does not render moments as a separate homepage section", () => {
  const homePageSource = readSource("pages/HomePage.jsx");

  assert.doesNotMatch(homePageSource, /MomentsHome/);
});

test("themes the moments and friends footer for their page palettes", () => {
  const footerSource = readSource("components/Footer.jsx");

  assert.match(footerSource, /moments:\s*\{/);
  assert.match(footerSource, /friends:\s*\{/);
  assert.match(footerSource, /pathname\.startsWith\("\/moments"\)/);
  assert.match(footerSource, /pathname\.startsWith\("\/friends"\)/);
});
