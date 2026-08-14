import test from "node:test";
import assert from "node:assert/strict";

import { friendCards } from "./friendCards.js";
import { cosAsset } from "../lib/cosAsset.js";

test("includes KoBariDev as a featured friend link", () => {
  const kobari = friendCards.find((friend) => friend.name === "KoBariDev");

  assert.ok(kobari);
  assert.equal(kobari.desc, "Ciallo～(∠・ω<)⌒★");
  assert.equal(kobari.url, "https://hub.131714.xyz/");
  assert.equal(
    kobari.avatar,
    cosAsset("picgo-uploads/download.png")
  );
});

test("includes Anze as a friend link with explicit avatar", () => {
  const anze = friendCards.find((friend) => friend.name === "安泽的温馨小窝");

  assert.ok(anze);
  assert.equal(anze.desc, "愿得一人心.");
  assert.equal(anze.url, "https://anze.love");
  assert.equal(anze.avatar, "https://anze.love/wp-content/uploads/2026/03/cropped-anze.jpg");
});

test("names the 930309 friend link Leyili Garden", () => {
  const leyiliMatches = friendCards.filter((friend) => friend.url === "https://930309.xyz/");
  const leyili = leyiliMatches[0];

  assert.equal(leyiliMatches.length, 1);
  assert.ok(leyili);
  assert.equal(leyili.name, "Leyili 花园");
  assert.equal(leyili.desc, "小小后花园~~~");
  assert.equal(leyili.avatar, "https://photo.930309.xyz/lcj.svg");
});

test("keeps the 090909 friend link as Tashuo", () => {
  const tashuo = friendCards.find((friend) => friend.url === "https://090909.top/");

  assert.ok(tashuo);
  assert.equal(tashuo.name, "他说");
  assert.equal(tashuo.desc, "梁栋烨的博客网站。");
  assert.equal(tashuo.avatar, "https://090909.top/assets/images/logo.ico");
});

test("keeps xiaomo friend link on the canonical domain", () => {
  const xiaomo = friendCards.find((friend) => friend.name === "xiaomo的小破站");

  assert.ok(xiaomo);
  assert.equal(xiaomo.desc, "愛をもって長き年月に立ち向かい、継続をもって心の遠き彼方へ赴く。");
  assert.equal(xiaomo.url, "https://xiaomoo.top/");
  assert.equal(xiaomo.avatar, "https://xiaomoo.top/images/dog.jpg");
});

test("keeps friend links published after Lingka", () => {
  const urls = new Set(friendCards.map((friend) => friend.url));

  assert.ok(friendCards.length >= 28);
  for (const url of [
    "https://justpureh2o.cn",
    "https://home.nibutupaopao.top",
    "https://123456l.com",
    "https://blog.zuodev.top",
    "https://www.minedensity.top",
    "https://keiyan.top",
    "https://blog.pldduck.com",
  ]) {
    assert.ok(urls.has(url), `missing friend link ${url}`);
  }
});
