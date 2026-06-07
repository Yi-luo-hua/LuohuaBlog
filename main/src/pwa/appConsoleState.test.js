import test from "node:test";
import assert from "node:assert/strict";

import {
  getBackendHealthLabel,
  getOwnerSessionLabel,
  getStatsSnapshot,
} from "./appConsoleState.js";

test("describes an owner session for the app console", () => {
  assert.equal(
    getOwnerSessionLabel({
      loggedIn: true,
      unlimited: true,
      user: { displayName: "Tao", email: "owner@example.test", isOwner: true },
    }),
    "Tao",
  );

  assert.equal(
    getOwnerSessionLabel({
      loggedIn: true,
      unlimited: true,
      user: { email: "owner@example.test", isOwner: true },
    }),
    "owner@example.test",
  );
});

test("falls back when the owner session is not confirmed", () => {
  assert.equal(getOwnerSessionLabel({ loggedIn: false }), "站长未确认");
  assert.equal(
    getOwnerSessionLabel({
      loggedIn: true,
      unlimited: false,
      user: { isOwner: true, email: "owner@example.test" },
    }),
    "站长安全验证待完成",
  );
});

test("summarizes backend health responses", () => {
  assert.equal(getBackendHealthLabel({ status: "ok", uid: "1061280173" }), "ok");
  assert.equal(getBackendHealthLabel(null), "检查中");
  assert.equal(getBackendHealthLabel({ status: "down" }), "down");
});

test("normalizes AI stats for the app console", () => {
  assert.deepEqual(
    getStatsSnapshot({
      configured: true,
      model: "deepseek-test",
      summary: {
        todaySuccess: 2,
        todayTotal: 3,
        periodSuccess: 10,
        periodTotal: 12,
        successRateText: "83%",
      },
    }),
    {
      configured: true,
      model: "deepseek-test",
      today: "2 / 3",
      period: "10 / 12",
      successRate: "83%",
    },
  );

  assert.equal(getStatsSnapshot(null).today, "0 / 0");
});
