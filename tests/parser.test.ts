import assert from "node:assert/strict";
import { test } from "node:test";
import { parseHosts } from "../src/parser.js";

const SAMPLE = `
# SSH config
Host web1
    HostName 192.168.1.10
    User ubuntu
    Port 22

Host db
    HostName db.internal
    User postgres
    IdentityFile ~/.ssh/db_key

Host *.example.com
    User deploy

Host *
    ServerAliveInterval 60
`;

test("parseHosts returns only concrete hosts", () => {
  const hosts = parseHosts(SAMPLE);
  assert.equal(hosts.length, 2);
});

test("parseHosts parses alias and hostname correctly", () => {
  const hosts = parseHosts(SAMPLE);
  assert.equal(hosts[0].alias, "web1");
  assert.equal(hosts[0].hostname, "192.168.1.10");
});

test("parseHosts parses user and port", () => {
  const hosts = parseHosts(SAMPLE);
  assert.equal(hosts[0].user, "ubuntu");
  assert.equal(hosts[0].port, 22);
});

test("parseHosts sets hasIdentityFile and never exposes path", () => {
  const hosts = parseHosts(SAMPLE);
  const db = hosts.find((h) => h.alias === "db");
  assert.ok(db);
  assert.equal(db.hasIdentityFile, true);
  assert.ok(!("identityFilePath" in db));
  assert.ok(!("identityFile" in db));
});

test("parseHosts: hasIdentityFile is false when not set", () => {
  const hosts = parseHosts(SAMPLE);
  assert.equal(hosts[0].hasIdentityFile, false);
});

test("parseHosts skips Host * and wildcard patterns", () => {
  const hosts = parseHosts(SAMPLE);
  assert.ok(!hosts.some((h) => h.alias === "*"));
  assert.ok(!hosts.some((h) => h.alias.includes("*")));
});

test("parseHosts uses alias as hostname when HostName not set", () => {
  const config = "Host myserver\n    User admin\n";
  const hosts = parseHosts(config);
  assert.equal(hosts[0].hostname, "myserver");
});

test("parseHosts handles empty and comment-only config", () => {
  assert.deepEqual(parseHosts(""), []);
  assert.deepEqual(parseHosts("# just a comment\n"), []);
});

test("parseHosts is case-insensitive for keywords", () => {
  const config = "HOST myserver\n    HOSTNAME 10.0.0.1\n    USER root\n";
  const hosts = parseHosts(config);
  assert.equal(hosts.length, 1);
  assert.equal(hosts[0].hostname, "10.0.0.1");
  assert.equal(hosts[0].user, "root");
});
