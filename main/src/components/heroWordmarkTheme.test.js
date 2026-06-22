import test from "node:test";
import assert from "node:assert/strict";

import {
  HERO_WORDMARK_THEMES,
  getHeroWordmarkStyle,
  getHeroWordmarkTheme,
} from "./heroWordmarkTheme.js";

test("provides four wordmark palettes for the hero wallpapers", () => {
  assert.deepEqual(
    Object.keys(HERO_WORDMARK_THEMES).map(Number),
    [1, 2, 3, 4]
  );

  assert.equal(getHeroWordmarkTheme(1).name, "peach-gold");
  assert.equal(getHeroWordmarkTheme(2).name, "moon-blue");
  assert.equal(getHeroWordmarkTheme(3).name, "star-violet");
  assert.equal(getHeroWordmarkTheme(4).name, "rain-mint");
});

test("keeps every wordmark stroke close to white for photo contrast", () => {
  Object.values(HERO_WORDMARK_THEMES).forEach((theme) => {
    assert.equal(theme.stroke, "rgba(255, 250, 242, 0.96)");
  });
});

test("falls back to the first wordmark palette for unknown indexes", () => {
  assert.equal(getHeroWordmarkTheme(99), HERO_WORDMARK_THEMES[1]);
});

test("maps a wordmark palette to CSS variables", () => {
  assert.deepEqual(getHeroWordmarkStyle(4), {
    "--hero-wordmark-stroke": "rgba(255, 250, 242, 0.96)",
    "--hero-wordmark-stroke-mid": "rgba(224, 255, 246, 0.94)",
    "--hero-wordmark-stroke-end": "rgba(255, 255, 255, 0.9)",
    "--hero-wordmark-fill": "rgba(255, 250, 242, 0.74)",
    "--hero-wordmark-fill-mid": "rgba(214, 255, 240, 0.58)",
    "--hero-wordmark-fill-end": "rgba(255, 255, 255, 0.5)",
    "--hero-wordmark-glow": "rgba(214, 255, 240, 0.76)",
    "--hero-wordmark-veil": "rgba(6, 20, 18, 0.2)",
  });
});
