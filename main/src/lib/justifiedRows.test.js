import test from "node:test";
import assert from "node:assert/strict";

import { DEFAULT_ASPECT, buildJustifiedRows, photoAspect } from "./justifiedRows.js";

const photo = (width, height, id = `${width}x${height}`) => ({ id, width, height });

// 原始尺寸够大时才能看出排布本身的行为，不会被“不放大”的封顶规则盖住。
const big = (aspect, id) => photo(Math.round(4000 * aspect), 4000, id);

test("photoAspect falls back to 3:2 when dimensions are missing or broken", () => {
  assert.equal(photoAspect({ width: 1200, height: 800 }), 1.5);
  assert.equal(photoAspect({ width: 0, height: 800 }), DEFAULT_ASPECT);
  assert.equal(photoAspect({ width: "wide", height: 800 }), DEFAULT_ASPECT);
  assert.equal(photoAspect(undefined), DEFAULT_ASPECT);
});

test("returns nothing until the container has been measured", () => {
  assert.deepEqual(buildJustifiedRows([photo(1200, 800)], { containerWidth: 0 }), []);
  assert.deepEqual(buildJustifiedRows([], { containerWidth: 1200 }), []);
});

test("a filled row spans the container width exactly", () => {
  const rows = buildJustifiedRows([big(1.5, "a"), big(1.5, "b"), big(0.75, "c"), big(1.5, "d")], {
    containerWidth: 1200,
    gap: 16,
    targetRowHeight: 280,
  });

  const filled = rows.filter((row, index) => index < rows.length - 1);
  assert.ok(filled.length > 0, "expected at least one filled row");

  for (const row of filled) {
    const spanned =
      row.items.reduce((sum, item) => sum + item.width, 0) + 16 * (row.items.length - 1);
    assert.ok(Math.abs(spanned - 1200) < 0.5, `row spanned ${spanned}, expected 1200`);
  }
});

test("keeps every photo, in order, exactly once", () => {
  const photos = Array.from({ length: 17 }, (_, index) =>
    big([1.5, 0.75, 1, 1.8][index % 4], `p${index}`),
  );
  const rows = buildJustifiedRows(photos, { containerWidth: 1100, targetRowHeight: 260 });

  const laidOut = rows.flatMap((row) => row.items.map((item) => item.photo.id));
  assert.deepEqual(laidOut, photos.map((item) => item.id));
});

test("every item keeps its original aspect ratio", () => {
  const photos = [big(1.5, "a"), big(0.75, "b"), big(2.4, "c"), big(1, "d")];
  const rows = buildJustifiedRows(photos, { containerWidth: 900, targetRowHeight: 240 });

  for (const row of rows) {
    for (const item of row.items) {
      const expected = photoAspect(item.photo);
      assert.ok(
        Math.abs(item.width / item.height - expected) < 1e-9,
        `${item.photo.id} distorted: ${item.width}x${item.height}`,
      );
    }
  }
});

test("does not upscale a photo past its original pixel height", () => {
  // 目标行高比这张小图本身还高，没有封顶的话就会被放大成糊图。
  const rows = buildJustifiedRows([photo(400, 300, "small")], {
    containerWidth: 1200,
    targetRowHeight: 400,
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].height, 300);
  assert.equal(rows[0].items[0].width, 400);
});

test("a narrow viewport drops to one photo per row instead of crushing them", () => {
  const rows = buildJustifiedRows([big(1.5, "a"), big(1.5, "b"), big(1.5, "c")], {
    containerWidth: 343,
    gap: 8,
    targetRowHeight: 200,
  });

  for (const row of rows) {
    assert.equal(row.items.length, 1, "expected one photo per row on a 343px container");
    assert.ok(row.height > 120, `row collapsed to ${row.height}px`);
  }
});

test("the last row is left alone rather than stretched to fill", () => {
  const rows = buildJustifiedRows([big(1.5, "a"), big(1.5, "b"), big(1.5, "c")], {
    containerWidth: 1200,
    gap: 16,
    targetRowHeight: 280,
  });

  const last = rows[rows.length - 1];
  assert.ok(last.height <= 280 + 1e-9, `last row stretched to ${last.height}`);
});

test("a lone tall portrait does not blow up to twice the container width", () => {
  const rows = buildJustifiedRows([photo(2000, 4000, "tall")], {
    containerWidth: 1200,
    targetRowHeight: 280,
  });

  assert.equal(rows.length, 1);
  assert.ok(rows[0].height <= 280 + 1e-9, `tall photo rendered ${rows[0].height}px high`);
});
