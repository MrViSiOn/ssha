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
    const statusMap: Record<string, HostStatus> = {};

    const buildLines = (): string[] => {
      const searchBar = query
        ? `  ${C.cyan}/${C.reset} ${query}${C.gray}_${C.reset}`
        : `  ${C.gray}/ type to filter${C.reset}`;

      const hostLines =
        filtered.length > 0
          ? filtered.map((h, i) =>
              hostLine(h, i === index, usage, statusMap[h.alias]),
            )
          : [`  ${C.gray}No matches for "${query}"${C.reset}`];

      return [
        `${C.bold}  ${title}${C.reset} ${C.gray}(↑↓ · Enter · Esc clear · q quit)${C.reset}`,
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
        render();
        return;
      }

      // Down arrow
      if (key === "\x1b[B") {
        if (filtered.length > 0) index = (index + 1) % filtered.length;
        render();
        return;
      }

      // Escape — clear query if active, quit if empty
      if (key === "\x1b") {
        if (query) {
          query = "";
          filtered = hosts;
          index = 0;
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
        render();
        return;
      }

      // 'q' quits only when search is empty
      if (key === "q" && !query) {
        exit(null);
        return;
      }

      // Printable characters → append to search query
      if (key.length === 1 && key.charCodeAt(0) >= 32) {
        query += key;
        filtered = filterHosts(hosts, query);
        index = 0;
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

    process.stdin.on("data", onData);

    process.once("SIGTERM", () => {
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
