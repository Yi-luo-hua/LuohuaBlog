import test from "node:test";
import assert from "node:assert/strict";

// data 层是纯静态清单，node:test 源码断言之外还能直接 import 校验结构——
// 保持零依赖（无 vitest），和 siteScope.test.js 一个思路。
const { musicTracks } = await import("./musicTracks.js");

test("every track carries id, title and a same-origin src", () => {
  assert.ok(Array.isArray(musicTracks));
  for (const track of musicTracks) {
    assert.ok(track.id, `track missing id: ${JSON.stringify(track)}`);
    assert.ok(track.title, `track ${track.id} missing title`);
    assert.match(
      track.src,
      /^\/(audio|cos)\//,
      `track ${track.id} src must stay on /audio/ or /cos/: ${track.src}`,
    );
    assert.equal(
      track.src,
      encodeURI(decodeURI(track.src)),
      `track ${track.id} src must keep URL-encoded path segments: ${track.src}`,
    );
  }
});

test("track ids are unique", () => {
  const ids = musicTracks.map((track) => track.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("preset BGM keeps the URL-encoded COS path used by the old navbar audio", () => {
  const preset = musicTracks.find((track) => track.id === "preset-loop");
  assert.ok(preset, "preset-loop track missing");
  assert.equal(
    preset.src,
    "/cos/AI%E8%87%AA%E5%8A%A8%E5%8C%96%E5%8D%9A%E5%AE%A2%E5%9B%BE%E7%89%87/main/audio/loop.mp3",
  );
  assert.ok(preset.title.length > 0);
  assert.ok(preset.artist.length > 0);
});
