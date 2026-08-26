import test from "node:test";
import assert from "node:assert/strict";

import {
  getBackendHealthLabel,
  getOwnerGuestbookContacts,
  getOwnerSessionLabel,
} from "./appConsoleState.js";

test("labels the owner session from the console status payload", () => {
  assert.equal(getOwnerSessionLabel({ owner: { displayName: "Tao" } }), "Tao");
  assert.equal(getOwnerSessionLabel({ owner: {} }), "站长");
});

test("says so when the console has not been unlocked", () => {
  assert.equal(getOwnerSessionLabel(null), "未解锁");
  assert.equal(getOwnerSessionLabel({}), "未解锁");
});

test("summarizes backend health responses", () => {
  assert.equal(getBackendHealthLabel({ status: "ok", uid: "1061280173" }), "ok");
  assert.equal(getBackendHealthLabel(null), "检查中");
  assert.equal(getBackendHealthLabel({ status: "down" }), "down");
});

test("uses the dedicated owner email directory for guestbook contacts", () => {
  const contacts = getOwnerGuestbookContacts({
    guestbookContacts: [
      {
        id: 3,
        source: "friends",
        nickname: "Visitor",
        contactEmail: "visitor@example.test",
        content: "friend request",
        createdAt: "2026-06-07T09:00:00Z",
      },
      {
        id: 4,
        source: "guestbook",
        nickname: "Member",
        contactEmail: "member@example.test",
      },
      { nickname: "NoContact" },
    ],
  });

  assert.deepEqual(
    contacts.map((item) => [item.source, item.nickname, item.contactEmail]),
    [
      ["friends", "Visitor", "visitor@example.test"],
      ["guestbook", "Member", "member@example.test"],
    ],
  );
  assert.deepEqual(getOwnerGuestbookContacts(null), []);
});

