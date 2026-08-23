import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { resolveBlogStaticPath } from "./blogStatic.mjs";

const publicDirectory = path.resolve("C:/site/blog/public");

test("maps blog article and asset URLs into the Hexo public directory", () => {
  assert.equal(
    resolveBlogStaticPath(
      publicDirectory,
      "/blog/2026/08/24/%E5%8D%9A%E5%AE%A2%E6%B5%8B%E8%AF%95/",
    ),
    path.join(publicDirectory, "2026", "08", "24", "博客测试", "index.html"),
  );
  assert.equal(
    resolveBlogStaticPath(publicDirectory, "/blog/css/index.css?v=1"),
    path.join(publicDirectory, "css", "index.css"),
  );
});

test("maps the blog root and ignores non-blog routes", () => {
  assert.equal(
    resolveBlogStaticPath(publicDirectory, "/blog/"),
    path.join(publicDirectory, "index.html"),
  );
  assert.equal(resolveBlogStaticPath(publicDirectory, "/moments"), undefined);
});

test("rejects paths that escape the Hexo public directory", () => {
  assert.equal(
    resolveBlogStaticPath(publicDirectory, "/blog/%2e%2e%2fsecret.txt"),
    null,
  );
});
