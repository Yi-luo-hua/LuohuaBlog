import test from "node:test";
import assert from "node:assert/strict";

import { friendCards } from "./friendCards.js";

test("includes KoBariDev as a featured friend link", () => {
  const kobari = friendCards.find((friend) => friend.name === "KoBariDev");

  assert.ok(kobari);
  assert.equal(kobari.desc, "Ciallo～(∠・ω<)⌒★");
  assert.equal(kobari.url, "https://hub.131714.xyz/");
  assert.equal(
    kobari.avatar,
    "https://tzyy-1330068502.cos.ap-beijing.myqcloud.com/picgo-uploads/download.png"
  );
});

test("includes Anze as a friend link with explicit avatar", () => {
  const anze = friendCards.find((friend) => friend.name === "安泽的温馨小窝");

  assert.ok(anze);
  assert.equal(anze.desc, "愿得一人心.");
  assert.equal(anze.url, "https://anze.love");
  assert.equal(anze.avatar, "https://anze.love/wp-content/uploads/2026/03/cropped-anze.jpg");
});
