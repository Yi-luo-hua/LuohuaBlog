import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readSource = (path) => readFileSync(resolve(sourceRoot, path), "utf8");

test("keeps the moments entry in the top navbar", () => {
  const navbarSource = readSource("components/Navbar.jsx");

  assert.match(navbarSource, /\{\s*label:\s*"碎语",\s*to:\s*"\/moments"/);
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
  for (const module of ["postcard", "ticket", "watercolor", "poem", "journal", "ribbon"]) {
    assert.match(cssSource, new RegExp(`\\.moments-module--${module}`));
  }
});

test("keeps varied moments modules in one balanced multicolor holographic card family", () => {
  const cssSource = readSource("index.css");
  const moduleNames = ["postcard", "ticket", "watercolor", "poem", "journal", "ribbon"];
  const toneNames = ["aurora", "ticket", "watercolor", "mist", "journal", "mint"];

  assert.match(cssSource, /--moment-holo:/);
  assert.match(cssSource, /--moment-holo-mint:/);
  assert.match(cssSource, /--moment-holo-blue:/);
  assert.match(cssSource, /--moment-holo-sun:/);
  assert.match(cssSource, /--moment-holo-lavender:/);

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
