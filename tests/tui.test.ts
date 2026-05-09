import assert from "node:assert/strict";
import { test } from "node:test";

// Interactive functions (selectHost, confirm, prompt) require a real TTY.
// Tests cover module shape and non-interactive helpers only.

test("tui module exports expected functions", async () => {
  const tui = await import("../src/tui.js");
  assert.equal(typeof tui.selectHost, "function");
  assert.equal(typeof tui.confirm, "function");
  assert.equal(typeof tui.prompt, "function");
});
