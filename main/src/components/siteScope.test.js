import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const read = (relativePath) =>
  readFileSync(new URL(relativePath, import.meta.url), "utf8");

test("keeps removed destinations out of the public route map and navigation", () => {
  const app = read("../App.jsx");
  const navbar = read("./Navbar.jsx");

  for (const path of ["ai-traffic", "friends", "ai-gallery", "login"]) {
    assert.doesNotMatch(app, new RegExp(`path=["']${path}["']`));
  }
  assert.doesNotMatch(navbar, /数据中心|Friends|\/ai-traffic|\/friends/);
});

test("deletes the unreachable pages instead of shipping them unrouted", () => {
  // Each of these was already cut from the route map, so nothing could open
  // them; they only survived as dead weight in the bundle. /login was worse
  // than dead — it dispatched a "blog-ai-open" event that no component has
  // listened for since the AI panel was removed, so the link went nowhere.
  for (const gone of [
    "../pages/FriendsPage.jsx",
    "../pages/AiTrafficPage.jsx",
    "../pages/AiGalleryPage.jsx",
    "../pages/LoginPage.jsx",
    "./FriendsApplicationBoard.jsx",
    "./EmojiPicker.jsx",
    "./VisitorNetworkBadge.jsx",
    "../services/guestbookMessagesApi.js",
    "../services/clientNetworkApi.js",
  ]) {
    assert.equal(
      existsSync(new URL(gone, import.meta.url)),
      false,
      `${gone} should have been deleted with its unreachable page`,
    );
  }

  assert.doesNotMatch(read("../App.jsx"), /blog-ai-open|LoginPage/);
});

test("removes the build-log subsite that still served the template author", () => {
  // /build/ shipped 桃之夭夭's own site — their title, byline, Bilibili link
  // and 22 of their articles — from this site's own domain. It is gone, so
  // nothing may link to it or try to build it again.
  const features = read("./Features.jsx");

  assert.equal(existsSync(new URL("../../../build", import.meta.url)), false);
  assert.doesNotMatch(features, /\/build\//);
  assert.doesNotMatch(read("../../../README.md"), /`build\/`/);
  assert.doesNotMatch(read("../../../.github/workflows/deploy.yml"), /build\/\*\*/);
});

test("removes the explore control and generated-image plaza from the homepage", () => {
  const hero = read("./Hero.jsx");
  const features = read("./Features.jsx");

  assert.doesNotMatch(hero, /EXPLORE|id=["']explore["']/);
  assert.doesNotMatch(features, /ai-gallery|生成图广场|ai-plaza-card/);
});

test("does not inject the legacy global blog assistant", () => {
  const html = read("../../index.html");
  const viteConfig = read("../../vite.config.js");
  const blogConfig = read("../../../blog/_config.butterfly.yml");

  assert.doesNotMatch(html, /ai-assistant|page-context/);
  assert.doesNotMatch(viteConfig, /aiAssistant|ai-assistant/);
  assert.doesNotMatch(blogConfig, /ai-assistant|page-context/);

  // Nothing injected the assistant any more, so the bundle it loaded was dead
  // weight sitting in the repo root. It is deleted, not merely unreferenced.
  assert.equal(existsSync(new URL("../../../shared", import.meta.url)), false);
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
