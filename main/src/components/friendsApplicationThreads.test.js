import test from "node:test";
import assert from "node:assert/strict";

import {
  flattenGuestbookThreads,
  isFriendApplicationContent,
  normalizeFriendsThreads,
} from "./friendsApplicationThreads.js";

test("detects valid friend application content", () => {
  assert.equal(
    isFriendApplicationContent(
      "站点名称：桃之夭夭\n站点链接：https://taozhiyy.top\n站点描述：桃之夭夭的小屋\n头像链接：https://img.test/1.png"
    ),
    true
  );
});

test("filters non-application top-level items but keeps replies", () => {
  const rows = [
    {
      id: 1,
      parentId: 0,
      content:
        "站点名称：桃之夭夭\n站点链接：https://taozhiyy.top\n站点描述：桃之夭夭的小屋\n头像链接：https://img.test/1.png",
      replies: [{ id: 2, parentId: 1, content: "已回访" }],
      replyCount: 1,
    },
    { id: 3, parentId: 0, content: "普通留言", replies: [], replyCount: 0 },
  ];

  const threads = normalizeFriendsThreads(rows);

  assert.equal(threads.length, 1);
  assert.equal(threads[0].replies.length, 1);
  assert.equal(threads[0].replyCount, 1);
});

test("flattens threaded guestbook rows for generic guestbook page usage", () => {
  const rows = [
    {
      id: 1,
      parentId: 0,
      content: "顶层",
      replies: [{ id: 2, parentId: 1, content: "回复" }],
    },
  ];

  const flattened = flattenGuestbookThreads(rows);

  assert.deepEqual(
    flattened.map((item) => item.id),
    [1, 2]
  );
});
