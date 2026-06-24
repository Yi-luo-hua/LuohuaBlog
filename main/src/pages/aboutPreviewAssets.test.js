import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { rewriteAboutPreviewAssets } from "./aboutPreviewAssets.js";

test("rewrites direct COS URLs in the about preview to the same-origin proxy", () => {
  const html = `
    <img src="https://tzyy-1330068502.cos.ap-beijing.myqcloud.com/about-page/demo.jpg" alt="">
    <a href="https://tzyy-1330068502.cos.ap-beijing.myqcloud.com/about-page/demo.svg">asset</a>
    <span style="background-image:url('https://tzyy-1330068502.cos.ap-beijing.myqcloud.com/about-page/demo.webp')"></span>
  `;

  const rewritten = rewriteAboutPreviewAssets(html);

  assert.doesNotMatch(rewritten, /cos\.ap-beijing\.myqcloud\.com/);
  assert.match(rewritten, /src="\/cos\/about-page\/demo\.jpg"/);
  assert.match(rewritten, /href="\/cos\/about-page\/demo\.svg"/);
  assert.match(rewritten, /url\('\/cos\/about-page\/demo\.webp'\)/);
});

test("adds async lazy image loading hints without overwriting explicit choices", () => {
  const html = `
    <img class="cover" src="/cos/about-page/demo.jpg" alt="demo">
    <img loading="eager" decoding="sync" src="/cos/about-page/hero.jpg" alt="hero">
  `;

  const rewritten = rewriteAboutPreviewAssets(html);

  assert.match(rewritten, /<img loading="lazy" decoding="async" class="cover"/);
  assert.match(rewritten, /<img loading="eager" decoding="sync" src="\/cos\/about-page\/hero\.jpg"/);
});

test("keeps the local Vite server aligned with the production COS proxy path", () => {
  const viteConfig = readFileSync(resolve("vite.config.js"), "utf8");

  assert.match(viteConfig, /["']\/cos["']\s*:/);
  assert.match(viteConfig, /tzyy-1330068502\.cos\.ap-beijing\.myqcloud\.com/);
  assert.ok(viteConfig.includes('rewrite: (path) => path.replace(/^\\/cos/, "")'));
});

test("uses asset rewriting before mounting the about preview markup", () => {
  const routeSource = readFileSync(resolve("src/pages/AboutSitePage.jsx"), "utf8");

  assert.match(routeSource, /import \{ rewriteAboutPreviewAssets \}/);
  assert.match(routeSource, /return rewriteAboutPreviewAssets\(`/);
});
