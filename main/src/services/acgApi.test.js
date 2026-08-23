import test from "node:test";
import assert from "node:assert/strict";

import { getBangumiCollection, getBangumiList } from "./acgApi.js";

const createJsonResponse = (payload) => ({
  ok: true,
  headers: {
    get(name) {
      return name.toLowerCase() === "content-type"
        ? "application/json; charset=utf-8"
        : null;
    },
  },
  async json() {
    return payload;
  },
});

test("getBangumiList keeps real collection items from the API", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async () =>
    createJsonResponse({
      items: [
        {
          id: "123",
          title: "真实番剧",
          watched: 4,
          total: 12,
        },
      ],
    });

  const items = await getBangumiList();

  assert.equal(items.length, 1);
  assert.equal(items[0].title, "真实番剧");
});

test("getBangumiList does not substitute mock data when sync is unavailable", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async () => {
    throw new Error("radar unavailable");
  };

  await assert.rejects(() => getBangumiList(), /unavailable/);
});

test("getBangumiCollection requests an independent collection and preserves tab counts", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  let requestedURL = "";
  globalThis.fetch = async (url) => {
    requestedURL = String(url);
    return createJsonResponse({
      items: [{ id: "done-1", title: "已经看过" }],
      counts: { watching: 27, watched: 120, wish: 38 },
    });
  };

  const result = await getBangumiCollection("watched");

  assert.match(requestedURL, /status=watched/);
  assert.equal(result.items[0].title, "已经看过");
  assert.deepEqual(result.counts, { watching: 27, watched: 120, wish: 38 });
});
