import test from "node:test";
import assert from "node:assert/strict";

import { loadWallpaperGift } from "./wallpaperGiftLoader.js";

test("falls back when the wallpaper request does not settle before the timeout", async () => {
  const fallback = { url: "https://example.test/fallback.jpg" };

  const result = await loadWallpaperGift({
    requestWallpaper: () => new Promise(() => {}),
    pickFallback: () => fallback,
    timeoutMs: 5,
  });

  assert.equal(result, fallback);
});

test("returns an unavailable gift instead of a local fallback in api-only mode", async () => {
  const result = await loadWallpaperGift({
    apiOnly: true,
    requestWallpaper: () => new Promise(() => {}),
    pickFallback: () => ({ url: "https://example.test/fallback.jpg" }),
    timeoutMs: 5,
  });

  assert.equal(result.url, "");
  assert.equal(result.sourceUrl, "https://taozhiyy.top/api/v1/wallpapers/draw?source=api");
});

