import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import type { SshHost } from "./types.js";

const HISTORY_PATH = join(homedir(), ".config", "ssha", "history.json");

export type UsageMap = Record<string, number>; // alias → timestamp ms

export function readUsage(): UsageMap {
  if (!existsSync(HISTORY_PATH)) return {};
  try {
    return JSON.parse(readFileSync(HISTORY_PATH, "utf-8")) as UsageMap;
  } catch {
    return {};
  }
}

export function recordUsage(alias: string): void {
  const usage = readUsage();
  usage[alias] = Date.now();
  const dir = dirname(HISTORY_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(HISTORY_PATH, JSON.stringify(usage, null, 2), "utf-8");
}

export function sortByLastUse(hosts: SshHost[], usage: UsageMap): SshHost[] {
  return [...hosts].sort(
    (a, b) => (usage[b.alias] ?? 0) - (usage[a.alias] ?? 0),
  );
}

export function formatAge(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60_000);
  const h = Math.floor(diff / 3_600_000);
  const d = Math.floor(diff / 86_400_000);
  if (m < 1) return "just now";
  if (h < 1) return `${m}m ago`;
  if (d < 1) return `${h}h ago`;
  if (d < 7) return `${d}d ago`;
  return `${Math.floor(d / 7)}w ago`;
}
