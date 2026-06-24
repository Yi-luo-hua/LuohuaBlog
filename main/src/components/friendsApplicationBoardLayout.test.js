import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readSource = (path) => readFileSync(resolve(sourceRoot, path), "utf8");

test("raises the active friends reply thread above following cards for emoji panels", () => {
  const source = readSource("components/FriendsApplicationBoard.jsx");

  assert.match(source, /activeReplyInThread/);
  assert.match(source, /activeReplyInThread\s*\?\s*"relative z-40"/);
  assert.match(source, /isReplyingToReply\s*&&\s*"relative z-30"/);
});
