import * as readline from "node:readline";
import { checkHost } from "./checker.js";
import type { HostStatus } from "./checker.js";
import type { SshHost } from "./types.js";
import type { UsageMap } from "./usage.js";
import { formatAge } from "./usage.js";

const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  gray: "\x1b[90m",
  clearLine: "\x1b[2K",
  clearDown: "\x1b[J",
  cursorHide: "\x1b[?25l",
  cursorShow: "\x1b[?25h",
  up: (n: number) => `\x1b[${n}A`,
};

interface SelectOptions {
  title?: string;
  usage?: UsageMap;
  checkConnectivity?: boolean;
  onTunnel?: (host: SshHost) => void;
}

function filterHosts(hosts: SshHost[], query: string): SshHost[] {
  if (!query) return hosts;
  const q = query.toLowerCase();
  return hosts.filter(
    (h) =>
      h.alias.toLowerCase().includes(q) ||
      h.hostname.toLowerCase().includes(q) ||
      (h.user ?? "").toLowerCase().includes(q) ||
      h.tags.some((t) => t.toLowerCase().includes(q)),
  );
}

function statusDot(status: HostStatus | undefined): string {
  if (!status || status === "checking") return `${C.gray}·${C.reset} `;
  if (status === "up") return `${C.green}●${C.reset} `;
  return `${C.red}●${C.reset} `;
}

function hostLine(
  host: SshHost,
  selected: boolean,
  usage: UsageMap,
  status?: HostStatus,
): string {
  const arrow = selected ? `${C.green}›${C.reset} ` : "  ";
  const dot = statusDot(status);
  const alias = selected ? `${C.bold}${host.alias}${C.reset}` : host.alias;
  const user = host.user ? ` ${C.cyan}${host.user}@${C.reset}` : "";
  const hn =
    host.hostname !== host.alias
      ? ` ${C.gray}→ ${host.hostname}${C.reset}`
      : "";
  const port =
    host.port && host.port !== 22 ? ` ${C.yellow}:${host.port}${C.reset}` : "";
  const tags =
    host.tags.length > 0 ? ` ${C.gray}[${host.tags.join(", ")}]${C.reset}` : "";
  const ts = usage[host.alias];
  const age = ts ? ` ${C.gray}${formatAge(ts)}${C.reset}` : "";
  return `${arrow}${dot}${alias}${user}${hn}${port}${tags}${age}`;
}

export async function selectHost(
  hosts: SshHost[],
  {
    title = "Select SSH server",
    usage = {},
    checkConnectivity = false,
    onTunnel,
  }: SelectOptions = {},
): Promise<SshHost | null> {
  if (!process.stdin.isTTY) {
    console.error("Error: interactive selection requires a TTY.");
    process.exit(1);
  }

  if (hosts.length === 0) return null;

  return new Promise((resolve) => {
    let index = 0;
    let rendered = 0;
    let query = "";
    let filtered = hosts;
    let active = true;
    let scrollOffset = 0;
    const statusMap: Record<string, HostStatus> = {};

    const visibleCount = () => Math.max(3, (process.stdout.rows ?? 24) - 6);

    const ensureVisible = () => {
      const vis = visibleCount();
      if (index < scrollOffset) scrollOffset = index;
      else if (index >= scrollOffset + vis) scrollOffset = index - vis + 1;
      if (scrollOffset < 0) scrollOffset = 0;
    };

    const buildLines = (): string[] => {
      const searchBar = query
        ? `  ${C.cyan}/${C.reset} ${query}${C.gray}_${C.reset}`
        : `  ${C.gray}/ type to filter${C.reset}`;

      const hasTunnels =
        filtered.length > 0 && (filtered[index]?.tunnels.length ?? 0) > 0;
      const tunnelHint = hasTunnels
        ? ` · ${C.yellow}f${C.reset}${C.gray} tunnel${C.reset}`
        : "";

      let hostLines: string[];
      if (filtered.length === 0) {
        hostLines = [`  ${C.gray}No matches for "${query}"${C.reset}`];
      } else {
        const vis = visibleCount();
        const slice = filtered.slice(scrollOffset, scrollOffset + vis);
        const above = scrollOffset;
        const below = filtered.length - scrollOffset - vis;
        hostLines = [
          ...(above > 0 ? [`  ${C.gray}↑ ${above} more${C.reset}`] : []),
          ...slice.map((h, i) =>
            hostLine(h, scrollOffset + i === index, usage, statusMap[h.alias]),
          ),
          ...(below > 0 ? [`  ${C.gray}↓ ${below} more${C.reset}`] : []),
        ];
      }

      return [
        `${C.bold}  ${title}${C.reset} ${C.gray}(↑↓ · Enter · Esc · q quit${C.reset}${tunnelHint}${C.gray})${C.reset}`,
        searchBar,
        "",
        ...hostLines,
        "",
      ];
    };

    const render = () => {
      if (rendered > 0) process.stdout.write(C.up(rendered));
      const output = buildLines();
      rendered = output.length;
      for (const l of output) process.stdout.write(`${C.clearLine}${l}\n`);
      process.stdout.write(C.clearDown);
    };

    const cleanup = () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write(C.cursorShow);
      if (rendered > 0) process.stdout.write(C.up(rendered) + C.clearDown);
    };

    const exit = (result: SshHost | null) => {
      active = false;
      process.stdin.off("data", onData);
      process.stdout.off("resize", onResize);
      cleanup();
      resolve(result);
    };

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    process.stdout.write(C.cursorHide);

    render();

    const onData = (key: string) => {
      // Ctrl+C — always quit
      if (key === "\x03") {
        exit(null);
        return;
      }

      // Enter — connect to selected
      if (key === "\r") {
        if (filtered.length > 0) exit(filtered[index]);
        return;
      }

      // Up arrow
      if (key === "\x1b[A") {
        if (filtered.length > 0)
          index = (index - 1 + filtered.length) % filtered.length;
        ensureVisible();
        render();
        return;
      }

      // Down arrow
      if (key === "\x1b[B") {
        if (filtered.length > 0) index = (index + 1) % filtered.length;
        ensureVisible();
        render();
        return;
      }

      // Escape — clear query if active, quit if empty
      if (key === "\x1b") {
        if (query) {
          query = "";
          filtered = hosts;
          index = 0;
          scrollOffset = 0;
          render();
        } else {
          exit(null);
        }
        return;
      }

      // Backspace
      if (key === "\x7f" || key === "\x08") {
        query = query.slice(0, -1);
        filtered = filterHosts(hosts, query);
        index = 0;
        scrollOffset = 0;
        render();
        return;
      }

      // 'q' quits only when search is empty
      if (key === "q" && !query) {
        exit(null);
        return;
      }

      // 'f' launches with port forwarding if server has tunnels
      if (key === "f" && !query && filtered.length > 0) {
        const host = filtered[index];
        if (host.tunnels.length > 0) {
          onTunnel?.(host);
          exit(host);
          return;
        }
      }

      // Printable characters → append to search query
      if (key.length === 1 && key.charCodeAt(0) >= 32) {
        query += key;
        filtered = filterHosts(hosts, query);
        index = 0;
        scrollOffset = 0;
        render();
        return;
      }
    };

    if (checkConnectivity) {
      for (const host of hosts) {
        statusMap[host.alias] = "checking";
        checkHost(host).then((status) => {
          if (!active) return;
          statusMap[host.alias] = status;
          render();
        });
      }
    }

    const onResize = () => {
      ensureVisible();
      render();
    };

    process.stdin.on("data", onData);
    process.stdout.on("resize", onResize);

    process.once("SIGTERM", () => {
      process.stdout.off("resize", onResize);
      cleanup();
      process.exit(0);
    });
  });
}

export async function selectMultipleHosts(
  hosts: SshHost[],
  {
    title = "Select SSH servers",
    usage = {},
  }: Pick<SelectOptions, "title" | "usage"> = {},
): Promise<SshHost[]> {
  if (!process.stdin.isTTY) {
    console.error("Error: interactive selection requires a TTY.");
    process.exit(1);
  }

  if (hosts.length === 0) return [];

  return new Promise((resolve) => {
    let index = 0;
    let rendered = 0;
    let query = "";
    let filtered = hosts;
    let scrollOffset = 0;
    const checked = new Set<string>();

    const visibleCount = () => Math.max(3, (process.stdout.rows ?? 24) - 6);

    const ensureVisible = () => {
      const vis = visibleCount();
      if (index < scrollOffset) scrollOffset = index;
      else if (index >= scrollOffset + vis) scrollOffset = index - vis + 1;
      if (scrollOffset < 0) scrollOffset = 0;
    };

    const buildLine = (host: SshHost, isCursor: boolean): string => {
      const arrow = isCursor ? `${C.green}›${C.reset} ` : "  ";
      const box = checked.has(host.alias)
        ? `${C.green}✓${C.reset} `
        : `${C.gray}·${C.reset} `;
      const alias = isCursor ? `${C.bold}${host.alias}${C.reset}` : host.alias;
      const user = host.user ? ` ${C.cyan}${host.user}@${C.reset}` : "";
      const hn =
        host.hostname !== host.alias
          ? ` ${C.gray}→ ${host.hostname}${C.reset}`
          : "";
      const port =
        host.port && host.port !== 22
          ? ` ${C.yellow}:${host.port}${C.reset}`
          : "";
      const tags =
        host.tags.length > 0
          ? ` ${C.gray}[${host.tags.join(", ")}]${C.reset}`
          : "";
      const ts = usage[host.alias];
      const age = ts ? ` ${C.gray}${formatAge(ts)}${C.reset}` : "";
      return `${arrow}${box}${alias}${user}${hn}${port}${tags}${age}`;
    };

    const buildLines = (): string[] => {
      const searchBar = query
        ? `  ${C.cyan}/${C.reset} ${query}${C.gray}_${C.reset}`
        : `  ${C.gray}/ type to filter${C.reset}`;

      const count =
        checked.size > 0
          ? ` · ${C.yellow}${checked.size} selected${C.reset}`
          : "";

      let hostLines: string[];
      if (filtered.length === 0) {
        hostLines = [`  ${C.gray}No matches for "${query}"${C.reset}`];
      } else {
        const vis = visibleCount();
        const slice = filtered.slice(scrollOffset, scrollOffset + vis);
        const above = scrollOffset;
        const below = filtered.length - scrollOffset - vis;
        hostLines = [
          ...(above > 0 ? [`  ${C.gray}↑ ${above} more${C.reset}`] : []),
          ...slice.map((h, i) => buildLine(h, scrollOffset + i === index)),
          ...(below > 0 ? [`  ${C.gray}↓ ${below} more${C.reset}`] : []),
        ];
      }

      return [
        `${C.bold}  ${title}${C.reset} ${C.gray}(↑↓ · Space select · Enter · Esc · q quit${C.reset}${count}${C.gray})${C.reset}`,
        searchBar,
        "",
        ...hostLines,
        "",
      ];
    };

    const render = () => {
      if (rendered > 0) process.stdout.write(C.up(rendered));
      const output = buildLines();
      rendered = output.length;
      for (const l of output) process.stdout.write(`${C.clearLine}${l}\n`);
      process.stdout.write(C.clearDown);
    };

    const cleanup = () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write(C.cursorShow);
      if (rendered > 0) process.stdout.write(C.up(rendered) + C.clearDown);
    };

    const exit = (result: SshHost[]) => {
      process.stdin.off("data", onData);
      process.stdout.off("resize", onResize);
      cleanup();
      resolve(result);
    };

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    process.stdout.write(C.cursorHide);

    render();

    const onData = (key: string) => {
      if (key === "\x03") {
        exit([]);
        return;
      }

      if (key === "\r") {
        const selection = filtered.filter((h) => checked.has(h.alias));
        exit(
          selection.length > 0
            ? selection
            : filtered[index]
              ? [filtered[index]]
              : [],
        );
        return;
      }

      if (key === "\x1b[A") {
        if (filtered.length > 0)
          index = (index - 1 + filtered.length) % filtered.length;
        ensureVisible();
        render();
        return;
      }

      if (key === "\x1b[B") {
        if (filtered.length > 0) index = (index + 1) % filtered.length;
        ensureVisible();
        render();
        return;
      }

      if (key === " ") {
        if (filtered.length > 0) {
          const alias = filtered[index]!.alias;
          if (checked.has(alias)) checked.delete(alias);
          else checked.add(alias);
          render();
        }
        return;
      }

      if (key === "\x1b") {
        if (query) {
          query = "";
          filtered = hosts;
          index = 0;
          scrollOffset = 0;
          render();
        } else {
          exit([]);
        }
        return;
      }

      if (key === "\x7f" || key === "\x08") {
        query = query.slice(0, -1);
        filtered = filterHosts(hosts, query);
        index = 0;
        scrollOffset = 0;
        render();
        return;
      }

      if (key === "q" && !query) {
        exit([]);
        return;
      }

      if (key.length === 1 && key.charCodeAt(0) >= 32) {
        query += key;
        filtered = filterHosts(hosts, query);
        index = 0;
        scrollOffset = 0;
        render();
        return;
      }
    };

    const onResize = () => {
      ensureVisible();
      render();
    };

    process.stdin.on("data", onData);
    process.stdout.on("resize", onResize);

    process.once("SIGTERM", () => {
      process.stdout.off("resize", onResize);
      cleanup();
      process.exit(0);
    });
  });
}

export async function confirm(question: string): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(
      `${C.yellow}?${C.reset} ${question} ${C.gray}(y/N)${C.reset} `,
      (answer) => {
        rl.close();
        resolve(answer.trim().toLowerCase() === "y");
      },
    );
  });
}

export async function prompt(
  question: string,
  required = false,
  defaultValue = "",
): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const ask = () => {
      const hint = defaultValue
        ? `${C.gray}(current: ${defaultValue}, Enter to keep)${C.reset}`
        : required
          ? `${C.gray}(required)${C.reset}`
          : `${C.gray}(optional, Enter to skip)${C.reset}`;
      rl.question(`${C.cyan}?${C.reset} ${question} ${hint}: `, (answer) => {
        const v = answer.trim();
        if (required && !v && !defaultValue) {
          ask();
          return;
        }
        rl.close();
        resolve(v !== "" ? v : defaultValue);
      });
    };

    ask();
  });
}
