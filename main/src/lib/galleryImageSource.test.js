import test from "node:test";
import assert from "node:assert/strict";

import { areUsableDimensions, isGalleryImageSource } from "./galleryImageSource.js";

test("accepts same-origin /cos/ paths and public http(s) urls", () => {
  assert.ok(isGalleryImageSource("/cos/gallery/2026/08/photo.jpg"));
  assert.ok(isGalleryImageSource("https://cdn.example/gallery/photo.jpg"));
  assert.ok(isGalleryImageSource("http://cdn.example/gallery/photo.jpg"));
  assert.ok(isGalleryImageSource("  /cos/gallery/photo.jpg  "));
});

test("rejects anything that is not a usable image location", () => {
  assert.ok(!isGalleryImageSource(""));
  assert.ok(!isGalleryImageSource(undefined));
  assert.ok(!isGalleryImageSource("/cos/"));
  assert.ok(!isGalleryImageSource("/api/owner/assets"));
  assert.ok(!isGalleryImageSource("gallery/photo.jpg"));
  assert.ok(!isGalleryImageSource("javascript:alert(1)"));
  // 协议相对地址会被浏览器解析到别的站点上去。
  assert.ok(!isGalleryImageSource("//evil.example/cos/photo.jpg"));
});

test("only whole positive pixel dimensions are usable", () => {
  assert.ok(areUsableDimensions(4000, 3000));
  assert.ok(!areUsableDimensions(0, 3000));
  assert.ok(!areUsableDimensions(-1, 10));
  assert.ok(!areUsableDimensions(1.5, 10));
  assert.ok(!areUsableDimensions(Number.NaN, 10));
  assert.ok(!areUsableDimensions(200000, 10));
});
