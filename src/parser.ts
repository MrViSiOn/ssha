import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { AddOptions, EditOptions, SshHost, Tunnel } from "./types.js";

interface HostBlock {
  alias: string;
  hostname?: string;
  user?: string;
  port?: number;
  identityFilePath?: string;
  tags?: string[];
  tunnels?: Tunnel[];
}

function parseKey(line: string): { key: string; value: string } | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  const spaceIdx = trimmed.search(/\s/);
  if (spaceIdx === -1) return null;
  return {
    key: trimmed.slice(0, spaceIdx).toLowerCase(),
    value: trimmed.slice(spaceIdx + 1).trim(),
  };
}

function isConcrete(alias: string): boolean {
  return !!alias && !alias.includes("*") && !alias.includes("?");
}

function toSshHost(block: HostBlock): SshHost {
  return {
    alias: block.alias,
    hostname: block.hostname ?? block.alias,
    user: block.user,
    port: block.port,
    hasIdentityFile: !!block.identityFilePath,
    tags: block.tags ?? [],
    tunnels: block.tunnels ?? [],
  };
}

function parseTags(line: string): string[] | null {
  const match = line.trim().match(/^#\s*ssha:tags=(.*)$/);
  if (!match) return null;
  return match[1]
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function tagsLine(tags: string[]): string {
  return `    # ssha:tags=${tags.join(",")}`;
}

function parseTunnels(line: string): Tunnel[] | null {
  const match = line.trim().match(/^#\s*ssha:tunnels=(.*)$/);
  if (!match) return null;
  return match[1]
    .split(",")
    .map((s) => {
      const parts = s.trim().split(":");
      if (parts.length < 3) return null;
      const localPort = parseInt(parts[0], 10);
      const remotePort = parseInt(parts[parts.length - 1], 10);
      const remoteHost = parts.slice(1, -1).join(":");
      if (isNaN(localPort) || isNaN(remotePort) || !remoteHost) return null;
      return { localPort, remoteHost, remotePort };
    })
    .filter((t): t is Tunnel => t !== null);
}

function tunnelToStr(t: Tunnel): string {
  return `${t.localPort}:${t.remoteHost}:${t.remotePort}`;
}

function tunnelsLine(tunnels: Tunnel[]): string {
  return `    # ssha:tunnels=${tunnels.map(tunnelToStr).join(",")}`;
}

export function parseHosts(content: string): SshHost[] {
  const hosts: SshHost[] = [];
  let current: HostBlock | null = null;

  for (const line of content.split("\n")) {
    const tags = parseTags(line);
    if (tags && current) {
      current.tags = tags;
      continue;
    }

    const tunnels = parseTunnels(line);
    if (tunnels && current) {
      current.tunnels = tunnels;
      continue;
    }

    const pair = parseKey(line);
    if (!pair) continue;

    if (pair.key === "host") {
      if (current && isConcrete(current.alias)) hosts.push(toSshHost(current));
      current = { alias: pair.value };
      continue;
    }

    if (!current) continue;

    switch (pair.key) {
      case "hostname":
        current.hostname = pair.value;
        break;
      case "user":
        current.user = pair.value;
        break;
      case "port":
        current.port = parseInt(pair.value, 10) || undefined;
        break;
      case "identityfile":
        current.identityFilePath = pair.value;
        break;
    }
  }

  if (current && isConcrete(current.alias)) hosts.push(toSshHost(current));
  return hosts;
}

export function addHost(configPath: string, opts: AddOptions): void {
  ensureConfig(configPath);

  const content = readFileSync(configPath, "utf-8");
  const existing = parseHosts(content);

  if (
    existing.some((h) => h.alias.toLowerCase() === opts.alias.toLowerCase())
  ) {
    throw new Error(`Host '${opts.alias}' already exists in ${configPath}`);
  }

  let block = `\nHost ${opts.alias}\n`;
  if (opts.tags && opts.tags.length > 0) block += `${tagsLine(opts.tags)}\n`;
  if (opts.tunnels && opts.tunnels.length > 0)
    block += `${tunnelsLine(opts.tunnels)}\n`;
  block += `    HostName ${opts.hostname}\n`;
  if (opts.user) block += `    User ${opts.user}\n`;
  if (opts.port && opts.port !== 22) block += `    Port ${opts.port}\n`;
  if (opts.identityFilePath)
    block += `    IdentityFile ${opts.identityFilePath}\n`;

  const trimmed = content.trimEnd();
  writeFileSync(configPath, (trimmed ? trimmed + "\n" : "") + block, "utf-8");
}

export function removeHost(configPath: string, alias: string): boolean {
  if (!existsSync(configPath)) return false;

  const content = readFileSync(configPath, "utf-8");
  const lines = content.split("\n");

  let blockStart = -1;
  let blockEnd = lines.length;

  for (let i = 0; i < lines.length; i++) {
    const pair = parseKey(lines[i]);
    if (!pair) continue;

    if (
      pair.key === "host" &&
      pair.value.toLowerCase() === alias.toLowerCase()
    ) {
      blockStart = i;
      continue;
    }

    if (blockStart !== -1 && pair.key === "host") {
      blockEnd = i;
      break;
    }
  }

  if (blockStart === -1) return false;

  const newLines = [...lines.slice(0, blockStart), ...lines.slice(blockEnd)];
  writeFileSync(configPath, newLines.join("\n"), "utf-8");
  return true;
}

export function editHost(
  configPath: string,
  alias: string,
  opts: EditOptions,
): boolean {
  if (!existsSync(configPath)) return false;

  const content = readFileSync(configPath, "utf-8");
  const lines = content.split("\n");

  let blockStart = -1;
  let blockEnd = lines.length;

  for (let i = 0; i < lines.length; i++) {
    const pair = parseKey(lines[i]);
    if (!pair) continue;
    if (
      pair.key === "host" &&
      pair.value.toLowerCase() === alias.toLowerCase()
    ) {
      blockStart = i;
      continue;
    }
    if (blockStart !== -1 && pair.key === "host") {
      blockEnd = i;
      break;
    }
  }

  if (blockStart === -1) return false;

  // Read current identityfile and tags internally — paths never exposed to the UI layer
  let currentIdentityFile: string | null = null;
  for (const line of lines.slice(blockStart, blockEnd)) {
    const pair = parseKey(line);
    if (pair?.key === "identityfile") currentIdentityFile = pair.value;
  }

  const identityFile =
    opts.identityFilePath === undefined
      ? currentIdentityFile
      : opts.identityFilePath || null;

  const blockLines: string[] = [`Host ${alias}`];
  if (opts.tags.length > 0) blockLines.push(tagsLine(opts.tags));
  if (opts.tunnels.length > 0) blockLines.push(tunnelsLine(opts.tunnels));
  blockLines.push(`    HostName ${opts.hostname}`);
  if (opts.user) blockLines.push(`    User ${opts.user}`);
  if (opts.port && opts.port !== 22) blockLines.push(`    Port ${opts.port}`);
  if (identityFile) blockLines.push(`    IdentityFile ${identityFile}`);

  const newLines = [
    ...lines.slice(0, blockStart),
    ...blockLines,
    ...lines.slice(blockEnd),
  ];

  writeFileSync(configPath, newLines.join("\n"), "utf-8");
  return true;
}

function ensureConfig(configPath: string): void {
  if (!existsSync(configPath)) {
    mkdirSync(dirname(configPath), { recursive: true, mode: 0o700 });
    writeFileSync(configPath, "", { encoding: "utf-8", mode: 0o600 });
  }
}
