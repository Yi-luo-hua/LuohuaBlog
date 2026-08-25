import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  loadBlogPosts,
  normalizeBlogAssetURL,
  parseBlogPost,
  parseFrontMatter,
  splitFrontMatter,
} from "./blogContent.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

test("parses Hexo front matter arrays and body", () => {
  const source = `---\ntitle: 我的文章\ndate: 2026-08-24 10:00:00\ntags: [React, Obsidian]\ncategories:\n  - 随笔\n---\n\n正文内容`;
  const split = splitFrontMatter(source);
  const meta = parseFrontMatter(split.frontMatter);

  assert.equal(meta.title, "我的文章");
  assert.deepEqual(meta.tags, ["React", "Obsidian"]);
  assert.deepEqual(meta.categories, ["随笔"]);
  assert.match(split.body, /正文内容/);
});

test("creates the deployed Hexo URL and a clean summary", () => {
  const post = parseBlogPost({
    filename: "伊洛华的第一篇文章.md",
    source: `---\ntitle: 伊洛华的第一篇文章\ndate: 2026-08-24\ntags: [随笔]\n---\n# 标题\n\n这是 **正文**。`,
  });

  assert.equal(
    post.url,
    "/blog/2026/08/24/%E4%BC%8A%E6%B4%9B%E5%8D%8E%E7%9A%84%E7%AC%AC%E4%B8%80%E7%AF%87%E6%96%87%E7%AB%A0/",
  );
  assert.equal(post.summary, "标题 这是 正文 。");
});

test("maps Hexo cover assets under the deployed blog root", () => {
  assert.equal(
    normalizeBlogAssetURL("/images/2026/08/cover.webp"),
    "/blog/images/2026/08/cover.webp",
  );
  assert.equal(
    normalizeBlogAssetURL("/blog/images/2026/08/cover.webp"),
    "/blog/images/2026/08/cover.webp",
  );
  assert.equal(
    normalizeBlogAssetURL("https://images.example/cover.webp"),
    "https://images.example/cover.webp",
  );

  const post = parseBlogPost({
    filename: "博客测试.md",
    source: `---\ntitle: 博客测试\ndate: 2026-08-24\ncover: "/images/2026/08/cover.webp"\n---\n正文`,
  });

  assert.equal(post.cover, "/blog/images/2026/08/cover.webp");
});

test("keeps every local post cover mapped to a versioned source file", async () => {
  const posts = await loadBlogPosts(
    resolve(repositoryRoot, "blog/source/_posts"),
  );

  for (const post of posts) {
    if (!post.cover.startsWith("/blog/")) continue;
    const sourcePath = resolve(
      repositoryRoot,
      "blog/source",
      post.cover.slice("/blog/".length),
    );
    assert.equal(
      existsSync(sourcePath),
      true,
      `${post.title} references a missing cover: ${post.cover}`,
    );
  }
});
