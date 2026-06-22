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

test("renders the taozhiyo wordmark inside the hero with the current wallpaper index", () => {
  assert.match(heroSource, /import HeroWordmark from "\.\/HeroWordmark"/);
  assert.match(heroSource, /<HeroWordmark heroIndex=\{currentIndex\} \/>/);
});

test("draws the taozhiyo wordmark from generated Pacifico glyph outlines", () => {
  assert.doesNotMatch(wordmarkSource, /<text\b/);
  assert.match(wordmarkSource, /PACIFICO_WORDMARK_PATHS/);
  assert.match(wordmarkSource, /generated from build\/src\/assets\/hello-font\.b64/);
  assert.match(wordmarkSource, /hero-wordmark-glyph/);
  assert.match(wordmarkSource, /hero-wordmark-stroke-path/);
  assert.match(wordmarkSource, /hero-wordmark-fill-after/);
  assert.match(wordmarkSource, /getTotalLength\(\)/);
  assert.match(wordmarkSource, /hero-wordmark--ready/);
  assert.doesNotMatch(wordmarkSource, /hero-wordmark-letter--/);
  assert.doesNotMatch(wordmarkSource, /hero-wordmark-cross/);
  assert.doesNotMatch(wordmarkSource, /hero-wordmark-dot/);
  assert.doesNotMatch(wordmarkSource, /hero-wordmark-swoosh/);
});

test("keeps the wordmark stroke outline thin enough to stay legible at hero size", () => {
  assert.match(cssSource, /\.hero-wordmark-stroke-path/);
  assert.match(cssSource, /stroke-width:\s*2/);
  assert.doesNotMatch(cssSource, /vector-effect:\s*non-scaling-stroke/);
});

test("uses the build homepage draw and fill animation pattern", () => {
  assert.match(cssSource, /\.hero-wordmark\s*{[^}]*opacity:\s*0\.96/s);
  assert.match(
    cssSource,
    /\.hero-wordmark--ready\s+\.hero-wordmark-stroke-path\s*{[^}]*animation:\s*heroWordmarkDraw/s
  );
  assert.match(cssSource, /@keyframes heroWordmarkDraw\s*{[^}]*stroke-dashoffset:\s*var\(--len\)/s);
  assert.match(cssSource, /@keyframes heroWordmarkFillIn\s*{/);
  assert.match(cssSource, /fill-opacity:\s*1/);
});
