import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pwaDir = dirname(fileURLToPath(import.meta.url));
const mainDir = resolve(pwaDir, "..", "..");
const publicDir = resolve(mainDir, "public");

test("manifest describes an installable personal app", async () => {
  const manifestPath = resolve(publicDir, "manifest.webmanifest");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

  assert.equal(manifest.name, "桃之夭夭");
  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.scope, "/");
  assert.equal(manifest.display, "standalone");
  assert.ok(
    manifest.icons.some(
      (icon) =>
        icon.src === "/pwa-icon.svg" &&
        icon.sizes === "any" &&
        icon.type === "image/svg+xml",
    ),
  );
});

test("service worker leaves live API traffic online-first", async () => {
  const workerPath = resolve(publicDir, "sw.js");
  const workerSource = await readFile(workerPath, "utf8");

  assert.match(workerSource, /url\.pathname\.startsWith\("\/api\/"\)/);
  assert.match(workerSource, /return;/);
});
