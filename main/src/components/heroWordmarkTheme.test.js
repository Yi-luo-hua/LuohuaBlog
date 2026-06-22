import test from "node:test";
import assert from "node:assert/strict";

import {
  HERO_WORDMARK_THEMES,
  getHeroWordmarkStyle,
  getHeroWordmarkTheme,
} from "./heroWordmarkTheme.js";

test("provides four wordmark palettes for the hero wallpapers (shifted by one for preview effect)", () => {
  assert.deepEqual(
    Object.keys(HERO_WORDMARK_THEMES).map(Number),
    [1, 2, 3, 4]
  );

  // wordmark color is shifted by +1 to preview the next wallpaper
  assert.equal(getHeroWordmarkTheme(1).name, "moon-blue");
  assert.equal(getHeroWordmarkTheme(2).name, "star-violet");
  assert.equal(getHeroWordmarkTheme(3).name, "rain-mint");
  assert.equal(getHeroWordmarkTheme(4).name, "peach-gold");
});

test("keeps every wordmark stroke close to white for photo contrast", () => {
  Object.values(HERO_WORDMARK_THEMES).forEach((theme) => {
    assert.equal(theme.stroke, "rgba(255, 250, 242, 0.96)");
  });
});

test("returns a valid palette for any index via the shift formula", () => {
  // formula: ((index - 1 + 1) % 4) + 1 → 99 maps to slot 4 (rain-mint)
  assert.equal(getHeroWordmarkTheme(99).name, "rain-mint");
  // negative / zero also resolves to a real palette
  assert.ok(Object.values(HERO_WORDMARK_THEMES).includes(getHeroWordmarkTheme(0)));
});

test("maps a wordmark palette to CSS variables (shifted)", () => {
  // index 4 → shifted to slot 1 (peach-gold)
  assert.deepEqual(getHeroWordmarkStyle(4), {
    "--hero-wordmark-stroke": "rgba(255, 250, 242, 0.96)",
    "--hero-wordmark-stroke-mid": "rgba(255, 232, 190, 0.94)",
    "--hero-wordmark-stroke-end": "rgba(255, 255, 255, 0.9)",
    "--hero-wordmark-fill": "rgba(255, 250, 242, 0.74)",
    "--hero-wordmark-fill-mid": "rgba(255, 226, 168, 0.56)",
    "--hero-wordmark-fill-end": "rgba(255, 255, 255, 0.5)",
    "--hero-wordmark-glow": "rgba(247, 210, 124, 0.76)",
    "--hero-wordmark-veil": "rgba(38, 18, 26, 0.18)",
  });
});
