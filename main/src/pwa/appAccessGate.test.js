import test from "node:test";
import assert from "node:assert/strict";

import {
  describeGateError,
  getAppAccessState,
  shouldShowPasswordForm,
} from "./appAccessGate.js";

test("shows the console once the gate reports this browser unlocked", () => {
  assert.equal(getAppAccessState({ unlocked: true }), "allowed");
  assert.equal(getAppAccessState({ unlocked: true, isLoading: true }), "allowed");
});

test("waits while the gate check is still in flight", () => {
  assert.equal(getAppAccessState({ isLoading: true }), "loading");
  assert.equal(shouldShowPasswordForm("loading"), false);
});

test("asks for the password when the browser is locked out", () => {
  assert.equal(getAppAccessState({}), "locked");
  assert.equal(getAppAccessState({ unlocked: false, isLoading: false }), "locked");
  assert.equal(shouldShowPasswordForm("locked"), true);
});

test("turns gate errors into something readable", () => {
  assert.equal(
    describeGateError({ status: 401, data: { error: "WRONG_PASSWORD" } }),
    "密码不对，再试一次。",
  );
  assert.equal(
    describeGateError({ status: 429, data: { error: "RATE_LIMITED" } }),
    "尝试太频繁了，等一分钟再试。",
  );
  assert.match(
    describeGateError({ status: 503, data: { error: "GATE_NOT_CONFIGURED" } }),
    /OWNER_GATE_PASSWORD/,
  );
  assert.match(
    describeGateError({ status: 503, data: { error: "GATE_PASSWORD_TOO_SHORT" } }),
    /太短/,
  );
  assert.match(describeGateError({ status: 0 }), /连不上后端/);
  assert.equal(describeGateError({ status: 500, data: { message: "炸了" } }), "炸了");
});
