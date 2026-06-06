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
