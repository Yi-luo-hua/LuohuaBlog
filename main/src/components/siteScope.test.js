import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const read = (relativePath) =>
  readFileSync(new URL(relativePath, import.meta.url), "utf8");

test("keeps removed destinations out of the public route map and navigation", () => {
  const app = read("../App.jsx");
  const navbar = read("./Navbar.jsx");

  for (const path of ["ai-traffic", "friends", "ai-gallery"]) {
    assert.doesNotMatch(app, new RegExp(`path=[\"']${path}[\"']`));
  }
  assert.doesNotMatch(navbar, /数据中心|Friends|\/ai-traffic|\/friends/);
});

test("removes the explore control and generated-image plaza from the homepage", () => {
  const hero = read("./Hero.jsx");
  const features = read("./Features.jsx");

  assert.doesNotMatch(hero, /EXPLORE|id=[\"']explore[\"']/);
  assert.doesNotMatch(features, /ai-gallery|生成图广场|ai-plaza-card/);
});

test("does not inject the legacy global blog assistant", () => {
  const html = read("../../index.html");
  const viteConfig = read("../../vite.config.js");
  const buildHtml = read("../../../build/index.html");
  const blogConfig = read("../../../blog/_config.butterfly.yml");
  const deployScript = read("../../../deploy/pull-deploy.sh");

  assert.doesNotMatch(html, /ai-assistant|page-context/);
  assert.doesNotMatch(viteConfig, /aiAssistant|ai-assistant/);
  assert.doesNotMatch(buildHtml, /ai-assistant|page-context/);
  assert.doesNotMatch(blogConfig, /ai-assistant|page-context/);
  assert.doesNotMatch(deployScript, /shared\/ai-assistant|TMP_DIR\/ai-assistant/);
});

test("uses the 伊洛华 identity, Yi-luo-hua wordmark, and omits the network badge", () => {
  const html = read("../../index.html");
  const hero = read("./Hero.jsx");
  const heroWordmark = read("./HeroWordmark.jsx");
  const navbar = read("./Navbar.jsx");

  assert.match(html, /<title>伊洛华<\/title>/);
  assert.match(html, /href="\/github-avatar-192\.png"/);
  assert.match(hero, />\s*伊洛华\s*</);
  assert.doesNotMatch(hero, /桃之夭夭|桃之<b>夭<\/b>夭/);
  assert.match(heroWordmark, /Yi-luo-hua/);
  assert.doesNotMatch(heroWordmark, /taozhiyo|桃之夭夭/);
  assert.match(navbar, /github-avatar\.png/);
  assert.doesNotMatch(navbar, /VisitorNetworkBadge|nav-left-network/);
});

test("removes the guest-note and SOURCE SLOT experiences", () => {
  const app = read("../App.jsx");
  const home = read("../pages/HomePage.jsx");
  const manifest = read("../../public/manifest.webmanifest");

  assert.doesNotMatch(app, /GuestbookPage|path=["']guestbook["']/);
  assert.doesNotMatch(home, /Story|Contact/);
  assert.doesNotMatch(manifest, /guestbook|留言板|留言小纸条/);
  for (const removedFile of ["./Story.jsx", "./Contact.jsx", "../pages/GuestbookPage.jsx"]) {
    assert.equal(existsSync(new URL(removedFile, import.meta.url)), false);
  }
});
