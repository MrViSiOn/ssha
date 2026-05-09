import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { addHost, parseHosts, removeHost } from "./parser.js";
import { connect } from "./ssh.js";
import { confirm, prompt, selectHost } from "./tui.js";
import type { CliArgs, Command } from "./types.js";
import { readUsage, recordUsage, sortByLastUse } from "./usage.js";

const VERSION = "0.1.0";
const DEFAULT_CONFIG = join(homedir(), ".ssh", "config");

const HELP = `
assh — SSH Server Manager

USAGE
  assh                  pick and connect to a server
  assh add              add a new server to ~/.ssh/config
  assh remove, rm       pick and remove a server
  assh list, ls         list all configured servers

OPTIONS
  --config <path>       use alternative SSH config (default: ~/.ssh/config)
  --json                JSON output (list only)
  -v, --version         show version
  -h, --help            show this help

EXAMPLES
  assh                  interactive server picker
  assh add              wizard to add a new server
  assh rm               pick and remove a server
  assh ls               show all configured servers
  assh ls --json        list servers as JSON
`.trim();

function parseCliArgs(): CliArgs {
  const args = process.argv.slice(2);
  let command: Command = "connect";
  let configPath = DEFAULT_CONFIG;
  let jsonOutput = false;
  let help = false;
  let version = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "add":
        command = "add";
        break;
      case "remove":
      case "rm":
        command = "remove";
        break;
      case "list":
      case "ls":
        command = "list";
        break;
      case "--config":
        configPath = args[++i] ?? configPath;
        break;
      case "--json":
        jsonOutput = true;
        break;
      case "-h":
      case "--help":
        help = true;
        break;
      case "-v":
      case "--version":
        version = true;
        break;
    }
  }

  return { command, configPath, jsonOutput, help, version };
}

async function cmdConnect(configPath: string): Promise<void> {
  if (!existsSync(configPath)) {
    console.log(
      "No SSH config found. Run `assh add` to add your first server.",
    );
    return;
  }

  const usage = readUsage();
  const hosts = sortByLastUse(
    parseHosts(readFileSync(configPath, "utf-8")),
    usage,
  );

  if (hosts.length === 0) {
    console.log("No servers configured. Run `assh add` to add one.");
    return;
  }

  const selected = await selectHost(hosts, { usage });
  if (!selected) return;

  recordUsage(selected.alias);
  connect(selected.alias);
}

async function cmdAdd(configPath: string): Promise<void> {
  const alias = await prompt("Server alias (e.g. my-server)", true);

  if (existsSync(configPath)) {
    const hosts = parseHosts(readFileSync(configPath, "utf-8"));
    if (hosts.some((h) => h.alias.toLowerCase() === alias.toLowerCase())) {
      console.error(`\nError: host '${alias}' already exists.`);
      process.exit(1);
    }
  }

  const hostname = await prompt("Hostname or IP", true);
  const user = await prompt("Username");
  const portStr = await prompt("Port (default 22)");
  const identityFilePath = await prompt("Path to private key (IdentityFile)");

  addHost(configPath, {
    alias,
    hostname,
    user: user || undefined,
    port: portStr ? parseInt(portStr, 10) : undefined,
    identityFilePath: identityFilePath || undefined,
  });

  console.log(`\n✓ Server '${alias}' added to ${configPath}`);
}

async function cmdRemove(configPath: string): Promise<void> {
  if (!existsSync(configPath)) {
    console.log("No SSH config found.");
    return;
  }

  const usage = readUsage();
  const hosts = sortByLastUse(
    parseHosts(readFileSync(configPath, "utf-8")),
    usage,
  );

  if (hosts.length === 0) {
    console.log("No servers to remove.");
    return;
  }

  const selected = await selectHost(hosts, {
    title: "Select server to remove",
    usage,
  });
  if (!selected) return;

  const ok = await confirm(
    `Remove '${selected.alias}' (${selected.hostname})?`,
  );
  if (!ok) {
    console.log("Cancelled.");
    return;
  }

  removeHost(configPath, selected.alias);
  console.log(`✓ Server '${selected.alias}' removed.`);
}

function pad(s: string, w: number): string {
  return s.length >= w ? s : s + " ".repeat(w - s.length);
}

function cmdList(configPath: string, json: boolean): void {
  if (!existsSync(configPath)) {
    if (json) process.stdout.write("[]\n");
    else console.log("No servers configured. Run `assh add` to add one.");
    return;
  }

  const hosts = parseHosts(readFileSync(configPath, "utf-8"));

  if (json) {
    const safe = hosts.map((h) => ({
      alias: h.alias,
      hostname: h.hostname,
      user: h.user ?? null,
      port: h.port ?? 22,
      identityFile: h.hasIdentityFile,
    }));
    process.stdout.write(JSON.stringify(safe, null, 2) + "\n");
    return;
  }

  if (hosts.length === 0) {
    console.log("No servers configured. Run `assh add` to add one.");
    return;
  }

  const B = "\x1b[1m";
  const R = "\x1b[0m";
  const G = "\x1b[90m";
  const CY = "\x1b[36m";

  const aw = Math.max(5, ...hosts.map((h) => h.alias.length));
  const hw = Math.max(8, ...hosts.map((h) => h.hostname.length));
  const uw = Math.max(4, ...hosts.map((h) => (h.user ?? "").length));

  console.log(
    [
      `${B}${pad("ALIAS", aw)}${R}`,
      `${B}${pad("HOSTNAME", hw)}${R}`,
      `${B}${pad("USER", uw)}${R}`,
      `${B}PORT${R}`,
      `${B}KEY${R}`,
    ].join("  "),
  );
  console.log(`${G}${"-".repeat(aw + hw + uw + 4 + 4 + 8)}${R}`);

  for (const h of hosts) {
    console.log(
      [
        `${CY}${pad(h.alias, aw)}${R}`,
        pad(h.hostname, hw),
        pad(h.user ?? "-", uw),
        pad(String(h.port ?? 22), 4),
        h.hasIdentityFile ? "✓" : "-",
      ].join("  "),
    );
  }
}

async function main(): Promise<void> {
  const args = parseCliArgs();

  if (args.version) {
    console.log(VERSION);
    return;
  }

  if (args.help) {
    console.log(HELP);
    return;
  }

  switch (args.command) {
    case "connect":
      await cmdConnect(args.configPath);
      break;
    case "add":
      await cmdAdd(args.configPath);
      break;
    case "remove":
      await cmdRemove(args.configPath);
      break;
    case "list":
      cmdList(args.configPath, args.jsonOutput);
      break;
  }
}

main().catch((err: Error) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
