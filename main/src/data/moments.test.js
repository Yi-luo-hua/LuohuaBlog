import test from "node:test";
import assert from "node:assert/strict";

import { moments } from "./moments.js";

test("keeps six homepage moments dated newest first from June 8", () => {
  assert.equal(moments.length, 6);
  assert.deepEqual(
    moments.map((moment) => moment.year),
    ["2026", "2026", "2026", "2026", "2026", "2026"]
  );
  assert.deepEqual(
    moments.map((moment) => moment.date),
    ["6.8", "6.7", "6.6", "6.5", "6.4", "6.3"]
  );
});

test("keeps the requested moment copy in order", () => {
  assert.deepEqual(
    moments.map((moment) => moment.lines.join("\n")),
    [
      "一滴泪真正的重量取决于它落在谁的心上",
      "计组实验怎么这么难？？？",
      "何时才能随心所欲用顶级大模型",
      "如果学会读心术就好了\n就不会这么累了",
      "犯错没关系，失去也没关系，这些年的浪费也没关系，都没关系。",
      "保持热爱，奔赴山海。",
    ]
  );
});

test("keeps 碎碎念 as the moment type, not body copy", () => {
  assert.equal(moments[2].type, "碎碎念");
  assert.doesNotMatch(moments[2].lines.join("\n"), /碎碎念/);
});

test("gives every moment a different visual module", () => {
  const modules = moments.map((moment) => moment.module);

  assert.deepEqual(modules, [
    "postcard",
    "ticket",
    "watercolor",
    "poem",
    "journal",
    "ribbon",
  ]);
  assert.equal(new Set(modules).size, moments.length);
});
