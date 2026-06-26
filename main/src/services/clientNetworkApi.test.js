import test from "node:test";
import assert from "node:assert/strict";

import { measureClientNetwork } from "./clientNetworkApi.js";

test("measureClientNetwork returns compact visitor network data and request latency", async () => {
  let requestedUrl = "";
  const result = await measureClientNetwork({
    fetchImpl: async (url) => {
      requestedUrl = url;
      return {
        ok: true,
        json: async () => ({
          regionLabel: "杭州",
          ipMasked: "123.45.*.*",
          serverTime: "2026-06-26T00:00:00Z",
        }),
      };
    },
    now: (() => {
      const marks = [100, 138];
      return () => marks.shift();
    })(),
  });

  assert.match(requestedUrl, /^\/api\/client\/network\?ts=\d+/);
  assert.deepEqual(result, {
    regionLabel: "杭州",
    ipMasked: "123.45.*.*",
    serverTime: "2026-06-26T00:00:00Z",
    latencyMs: 38,
  });
});

test("measureClientNetwork throws readable errors for failed responses", async () => {
  await assert.rejects(
    () =>
      measureClientNetwork({
        fetchImpl: async () => ({
          ok: false,
          json: async () => ({ message: "network unavailable" }),
        }),
        now: () => 0,
      }),
    /network unavailable/,
  );
});
