import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const heroSource = readFileSync(new URL("./Hero.jsx", import.meta.url), "utf8");

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
