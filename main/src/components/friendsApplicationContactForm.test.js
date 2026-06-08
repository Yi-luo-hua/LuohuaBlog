import test from "node:test";
import assert from "node:assert/strict";

import { buildFriendsApplicationPayload } from "./friendsApplicationContactForm.js";

test("anonymous friends application requires nickname and contact email", () => {
  assert.deepEqual(
    buildFriendsApplicationPayload({
      user: null,
      nickname: "",
      contactEmail: "visitor@example.com",
      content: "hello",
    }),
    { ok: false, error: "请留下昵称。" },
  );

  assert.deepEqual(
    buildFriendsApplicationPayload({
      user: null,
      nickname: "Visitor",
      contactEmail: "",
      content: "hello",
    }),
    { ok: false, error: "请留下邮箱，方便收到回复通知。" },
  );
});

test("anonymous friends application includes private contact email", () => {
  assert.deepEqual(
    buildFriendsApplicationPayload({
      user: null,
      nickname: " Visitor ",
      contactEmail: " Visitor@Example.COM ",
      content: " hello friends ",
    }),
    {
      ok: true,
      payload: {
        nickname: "Visitor",
        contactEmail: "visitor@example.com",
        content: "hello friends",
      },
    },
  );
});

test("logged-in friends application uses optional override email only when filled", () => {
  assert.deepEqual(
    buildFriendsApplicationPayload({
      user: { email: "account@example.com" },
      nickname: "",
      contactEmail: "",
      content: " hello ",
    }),
    { ok: true, payload: { content: "hello" } },
  );

  assert.deepEqual(
    buildFriendsApplicationPayload({
      user: { email: "account@example.com" },
      nickname: "",
      contactEmail: "Override@Example.com",
      content: " hello ",
    }),
    { ok: true, payload: { content: "hello", contactEmail: "override@example.com" } },
  );
});

test("friends application rejects invalid contact email", () => {
  assert.deepEqual(
    buildFriendsApplicationPayload({
      user: null,
      nickname: "Visitor",
      contactEmail: "bad-email",
      content: "hello",
    }),
    { ok: false, error: "请输入有效的邮箱地址。" },
  );
});
