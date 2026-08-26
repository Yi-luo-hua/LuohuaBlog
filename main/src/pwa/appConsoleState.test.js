import test from "node:test";
import assert from "node:assert/strict";

import {
  getBackendHealthLabel,
  getOwnerFixedAnswers,
  getOwnerGuestbookContacts,
  getOwnerSessionLabel,
  getStatsSnapshot,
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

test("uses backend fixed answers for the app console AI screen", () => {
  const answers = getOwnerFixedAnswers({
    ai: {
      fixedAnswers: [
        {
          id: 2,
          question: "How do friend links work?",
          answer: "Use the friends page application flow.",
          updatedAt: "2026-06-08T09:00:00Z",
        },
      ],
    },
  });

  assert.deepEqual(
    answers.map((item) => [item.id, item.question, item.answer]),
    [[2, "How do friend links work?", "Use the friends page application flow."]],
  );
  assert.deepEqual(getOwnerFixedAnswers(null), []);
});
