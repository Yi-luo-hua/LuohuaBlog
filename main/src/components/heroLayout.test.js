import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const heroSource = readFileSync(new URL("./Hero.jsx", import.meta.url), "utf8");
const cssSource = readFileSync(new URL("../index.css", import.meta.url), "utf8");
const wordmarkSource = readFileSync(
  new URL("./HeroWordmark.jsx", import.meta.url),
  "utf8"
);

test("keeps the fixed-height hero shell from becoming a vertical scroll container", () => {
  assert.match(
    heroSource,
    /className="relative h-dvh w-screen overflow-hidden"/
  );
  assert.doesNotMatch(
    heroSource,
    /className="relative h-dvh w-screen overflow-x-hidden"/
  );
});

test("loads hero media through the same-origin COS proxy", () => {
  assert.match(heroSource, /cosAsset\(/);
  assert.doesNotMatch(heroSource, /cos\.ap-beijing\.myqcloud\.com/);
});

test("renders the Yi-luo-hua wordmark inside the hero with the current wallpaper index", () => {
  assert.match(heroSource, /import HeroWordmark from "\.\/HeroWordmark"/);
  assert.match(heroSource, /<HeroWordmark heroIndex=\{currentIndex\} \/>/);
});

test("renders the Yi-luo-hua wordmark as an accessible title", () => {
  assert.match(wordmarkSource, /<text\b/);
  assert.match(wordmarkSource, /Yi-luo-hua/);
  assert.match(wordmarkSource, /aria-label="Yi-luo-hua"/);
  assert.match(wordmarkSource, /hero-wordmark-text/);
  assert.match(wordmarkSource, /hero-wordmark--ready/);
});

test("uses a restrained handwritten treatment for the wordmark", () => {
  assert.match(cssSource, /\.hero-wordmark-text/);
  assert.match(cssSource, /font-family:[^;]*Segoe Script/);
  assert.match(cssSource, /paint-order:\s*stroke fill/);
});

test("keeps the Yi-luo-hua wordmark out of the main phone hero content", () => {
  const mobileBlock = cssSource.match(
    /@media \(max-width:\s*767px\)\s*\{[\s\S]*?\.hero-wordmark\s*\{(?<rules>[\s\S]*?)\n\s*\}/
  );

  assert.ok(mobileBlock, "missing mobile hero wordmark rules");
  assert.match(mobileBlock.groups.rules, /top:\s*4\.85rem/);
  assert.match(mobileBlock.groups.rules, /left:\s*auto/);
  assert.match(mobileBlock.groups.rules, /right:\s*0\.75rem/);
  assert.match(mobileBlock.groups.rules, /width:\s*clamp\(7\.5rem,\s*38vw,\s*10\.5rem\)/);
  assert.match(mobileBlock.groups.rules, /z-index:\s*34/);
  assert.match(mobileBlock.groups.rules, /transform:\s*translate3d\(0,\s*0,\s*0\)/);
});

test("uses a soft reveal animation for the homepage wordmark", () => {
  assert.match(cssSource, /\.hero-wordmark\s*{[^}]*opacity:\s*1/s);
  assert.match(
    cssSource,
    /\.hero-wordmark--ready\s+\.hero-wordmark-text\s*{[^}]*animation:\s*heroWordmarkReveal/s
  );
  assert.match(cssSource, /@keyframes heroWordmarkReveal\s*{/);
  assert.match(cssSource, /filter:\s*blur\(0\)/);
});

test("keeps only the avatar and cover switcher in the homepage top-left row", () => {
  const navbarSource = readFileSync(new URL("./Navbar.jsx", import.meta.url), "utf8");

  assert.doesNotMatch(navbarSource, /VisitorNetworkBadge/);
  assert.match(navbarSource, /className="nav-left-tools"/);
  assert.match(navbarSource, /aria-label="Home"/);
  assert.match(navbarSource, /SWITCH COVER/);
  assert.ok(
    navbarSource.indexOf('aria-label="Home"') <
      navbarSource.indexOf("SWITCH COVER"),
    "avatar should stay at the far left of the home toolbar"
  );
  assert.match(cssSource, /\.nav-left-tools\s*\{[^}]*@apply flex[^}]*flex-wrap:\s*nowrap;/s);
});
