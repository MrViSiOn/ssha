import assert from "node:assert/strict";
import { test } from "node:test";
import { formatAge, sortByLastUse } from "../src/usage.js";
import type { SshHost } from "../src/types.js";

const hosts: SshHost[] = [
  { alias: "a", hostname: "a.com", hasIdentityFile: false },
  { alias: "b", hostname: "b.com", hasIdentityFile: false },
  { alias: "c", hostname: "c.com", hasIdentityFile: false },
];

test("sortByLastUse puts most recent first", () => {
  const usage = { a: 1000, b: 3000, c: 2000 };
  const sorted = sortByLastUse(hosts, usage);
  assert.equal(sorted[0].alias, "b");
  assert.equal(sorted[1].alias, "c");
  assert.equal(sorted[2].alias, "a");
});

test("sortByLastUse puts never-used hosts last", () => {
  const usage = { b: 1000 };
  const sorted = sortByLastUse(hosts, usage);
  assert.equal(sorted[0].alias, "b");
  assert.equal(sorted.length, 3);
});

test("sortByLastUse returns all hosts when usage is empty", () => {
  const sorted = sortByLastUse(hosts, {});
  assert.equal(sorted.length, 3);
});

test("sortByLastUse does not mutate the input array", () => {
  const original = [...hosts];
  sortByLastUse(hosts, { b: 9999 });
  assert.deepEqual(hosts, original);
});

test("formatAge: less than a minute", () => {
  const ts = Date.now() - 30_000;
  assert.equal(formatAge(ts), "just now");
});

test("formatAge: minutes", () => {
  const ts = Date.now() - 10 * 60_000;
  assert.equal(formatAge(ts), "10m ago");
});

test("formatAge: hours", () => {
  const ts = Date.now() - 3 * 3_600_000;
  assert.equal(formatAge(ts), "3h ago");
});

test("formatAge: days", () => {
  const ts = Date.now() - 2 * 86_400_000;
  assert.equal(formatAge(ts), "2d ago");
});

test("formatAge: weeks", () => {
  const ts = Date.now() - 14 * 86_400_000;
  assert.equal(formatAge(ts), "2w ago");
});
