import assert from "node:assert/strict";
import test from "node:test";

import {
  parseBlogPost,
  parseFrontMatter,
  splitFrontMatter,
} from "./blogContent.mjs";

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
