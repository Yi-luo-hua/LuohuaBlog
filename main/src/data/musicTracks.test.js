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

// 生成器曾经把每块的结尾逗号和 join 的逗号叠在一起写出 "},,"——那在数组
// 字面量里是一个空洞，musicTracks 里会混进 undefined，播放器建索引时当场抛。
// 清单只有一首时 join 根本不执行，所以这个 bug 藏到收录第二首才现形。
test("manifest has no array holes", () => {
  for (let index = 0; index < musicTracks.length; index += 1) {
    assert.ok(index in musicTracks, `hole at index ${index}`);
    assert.ok(musicTracks[index], `undefined entry at index ${index}`);
  }
});

test("covers, when present, live beside the audio under /audio/", () => {
  for (const track of musicTracks) {
    if (!track.cover) continue;
    assert.match(
      track.cover,
      /^\/(audio|cos)\//,
      `track ${track.id} cover must stay same-origin: ${track.cover}`,
    );
  }
});
