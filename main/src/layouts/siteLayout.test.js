import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const siteLayoutSource = readFileSync(
  new URL("./SiteLayout.jsx", import.meta.url),
  "utf8"
);

test("keeps the site shell from becoming a vertical scroll container", () => {
  assert.match(siteLayoutSource, /overflow-x-clip/);
  assert.doesNotMatch(siteLayoutSource, /overflow-x-hidden/);
});

test("drops the site footer on the full-screen about board", () => {
  assert.match(siteLayoutSource, /FULL_SCREEN_ROUTES = new Set\(\["\/about"\]\)/);
  assert.match(
    siteLayoutSource,
    /FULL_SCREEN_ROUTES\.has\(pathname\) \? null : <Footer \/>/,
  );
});
