import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const heroSource = readFileSync(new URL("./Hero.jsx", import.meta.url), "utf8");
const cssSource = readFileSync(
  new URL("../index.css", import.meta.url),
  "utf8",
);
const wordmarkSource = readFileSync(
  new URL("./HeroWordmark.jsx", import.meta.url),
  "utf8",
);
const wordmarkGlyphSource = readFileSync(
  new URL("./heroWordmarkGlyphs.js", import.meta.url),
  "utf8",
);

test("keeps the fixed-height hero shell from becoming a vertical scroll container", () => {
  assert.match(
    heroSource,
    /className="relative h-dvh w-screen overflow-hidden"/,
  );
  assert.doesNotMatch(
    heroSource,
    /className="relative h-dvh w-screen overflow-x-hidden"/,
  );
});

test("keeps the floating Reimu cover as the default hero", () => {
  assert.match(
    heroSource,
    /const \[currentIndex, setCurrentIndex\] = useState\(1\)/,
  );
  assert.match(
    heroSource,
    /1:\s*\{[\s\S]*?src: `\$\{COS\}\/img\/hero-4\.webp`/,
  );
  assert.match(heroSource, /label: "泡水灵梦"/);
});

test("adds the captured 4K Atri loop to the cover switcher", () => {
  assert.match(heroSource, /src: "\/media\/hero-atri-4k\.mp4"/);
  assert.match(heroSource, /poster: "\/media\/hero-atri-4k\.webp"/);
  assert.match(heroSource, /label: "花海亚托莉"/);
  assert.match(heroSource, /document\.createElement\("video"\)/);
  assert.match(heroSource, /video\.addEventListener\("canplay"/);
});

test("supports static and muted inline looping hero media", () => {
  assert.match(heroSource, /const HeroBackgroundMedia/);
  assert.match(heroSource, /if \(media\.type === "video"\)/);
  assert.match(heroSource, /<video[\s\S]*?autoPlay[\s\S]*?muted[\s\S]*?loop/);
  assert.match(heroSource, /playsInline/);
  assert.match(heroSource, /<img[\s\S]*?loading="eager"/);
  assert.match(heroSource, /<HeroBackgroundMedia[\s\S]*?id="bg-image"/);
});

test("renders the Yi-luo-hua wordmark inside the hero with the current wallpaper index", () => {
  assert.match(heroSource, /import HeroWordmark from "\.\/HeroWordmark"/);
  assert.match(heroSource, /<HeroWordmark heroIndex=\{currentIndex\} \/>/);
});

test("draws the Yi-luo-hua wordmark from generated Pacifico glyph outlines", () => {
  assert.doesNotMatch(wordmarkSource, /<text\b/);
  assert.match(wordmarkSource, /WORDMARK_LABEL = "Yi-luo-hua"/);
  assert.match(wordmarkSource, /aria-label=\{WORDMARK_LABEL\}/);
  assert.match(wordmarkSource, /YI_LUO_HUA_WORDMARK_PATHS/);
  assert.match(wordmarkGlyphSource, /Pacifico Regular \(SIL OFL 1\.1\)/);
  assert.match(wordmarkSource, /hero-wordmark-glyph/);
  assert.match(wordmarkSource, /hero-wordmark-stroke-path/);
  assert.match(wordmarkSource, /hero-wordmark-fill-after/);
  assert.match(wordmarkSource, /getTotalLength\(\)/);
  assert.match(wordmarkSource, /hero-wordmark--ready/);
});

test("keeps the animated wordmark stroke rounded and legible", () => {
  assert.match(cssSource, /\.hero-wordmark-stroke-path/);
  assert.match(cssSource, /stroke-width:\s*2\.6/);
  assert.match(cssSource, /stroke-linecap:\s*round/);
  assert.match(cssSource, /stroke-linejoin:\s*round/);
});

test("keeps the Yi-luo-hua wordmark out of the main phone hero content", () => {
  const mobileBlock = cssSource.match(
    /@media \(max-width:\s*767px\)\s*\{[\s\S]*?\.hero-wordmark\s*\{(?<rules>[\s\S]*?)\n\s*\}/,
  );

  assert.ok(mobileBlock, "missing mobile hero wordmark rules");
  assert.match(mobileBlock.groups.rules, /top:\s*4\.85rem/);
  assert.match(mobileBlock.groups.rules, /left:\s*auto/);
  assert.match(mobileBlock.groups.rules, /right:\s*0\.75rem/);
  assert.match(
    mobileBlock.groups.rules,
    /width:\s*clamp\(7\.5rem,\s*38vw,\s*10\.5rem\)/,
  );
  assert.match(mobileBlock.groups.rules, /z-index:\s*34/);
  assert.match(
    mobileBlock.groups.rules,
    /transform:\s*translate3d\(0,\s*0,\s*0\)/,
  );
});

test("restores the draw, fill, and glow animation for the homepage wordmark", () => {
  assert.match(cssSource, /\.hero-wordmark\s*{[^}]*opacity:\s*1/s);
  assert.match(
    cssSource,
    /\.hero-wordmark--ready\s+\.hero-wordmark-stroke-path\s*{[^}]*animation:\s*heroWordmarkDraw/s,
  );
  assert.match(
    cssSource,
    /@keyframes heroWordmarkDraw\s*{[^}]*stroke-dashoffset:\s*var\(--len\)/s,
  );
  assert.match(cssSource, /@keyframes heroWordmarkFillIn\s*{/);
  assert.match(cssSource, /@keyframes heroWordmarkGlowPulse\s*{/);
  assert.match(cssSource, /fill-opacity:\s*1/);
});

test("keeps only the avatar and cover switcher in the homepage top-left row", () => {
  const navbarSource = readFileSync(
    new URL("./Navbar.jsx", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(navbarSource, /VisitorNetworkBadge/);
  assert.match(navbarSource, /className="nav-left-tools"/);
  assert.match(navbarSource, /aria-label="Home"/);
  assert.match(navbarSource, /SWITCH COVER/);
  assert.ok(
    navbarSource.indexOf('aria-label="Home"') <
      navbarSource.indexOf("SWITCH COVER"),
    "avatar should stay at the far left of the home toolbar",
  );
  assert.match(
    cssSource,
    /\.nav-left-tools\s*\{[^}]*@apply flex[^}]*flex-wrap:\s*nowrap;/s,
  );
});
