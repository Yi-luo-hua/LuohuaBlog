import test from "node:test";
import assert from "node:assert/strict";

import { copyTextToClipboard } from "./copyTextToClipboard.js";

test("copies contact text through the modern clipboard API", async () => {
  let copied = "";

  await copyTextToClipboard("akesakiko@gmail.com", {
    navigatorRef: { clipboard: { writeText: async (value) => { copied = value; } } },
    documentRef: undefined,
  });

  assert.equal(copied, "akesakiko@gmail.com");
});

test("falls back to a temporary selection when clipboard permission is denied", async () => {
  const input = {
    value: "",
    style: {},
    setAttribute() {},
    focus() {},
    select() {},
    remove() { this.removed = true; },
  };
  let appended;
  const documentRef = {
    body: { appendChild(node) { appended = node; } },
    createElement: () => input,
    execCommand: (command) => command === "copy",
  };

  await copyTextToClipboard("3043882857", {
    navigatorRef: { clipboard: { writeText: async () => { throw new Error("denied"); } } },
    documentRef,
  });

  assert.equal(appended.value, "3043882857");
  assert.equal(input.removed, true);
});

test("reports failure when neither clipboard path is available", async () => {
  await assert.rejects(
    copyTextToClipboard("3043882857", { navigatorRef: {}, documentRef: undefined }),
    /unavailable/,
  );
});
