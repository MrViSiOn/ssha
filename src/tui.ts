import * as readline from "node:readline";
import type { SshHost } from "./types.js";

const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  gray: "\x1b[90m",
  clearLine: "\x1b[2K",
  cursorHide: "\x1b[?25l",
  cursorShow: "\x1b[?25h",
  up: (n: number) => `\x1b[${n}A`,
};

function hostLine(host: SshHost, selected: boolean): string {
  const arrow = selected ? `${C.green}›${C.reset} ` : "  ";
  const alias = selected ? `${C.bold}${host.alias}${C.reset}` : host.alias;
  const user = host.user ? ` ${C.cyan}${host.user}@${C.reset}` : "";
  const hn =
    host.hostname !== host.alias
      ? ` ${C.gray}→ ${host.hostname}${C.reset}`
      : "";
  const port =
    host.port && host.port !== 22 ? ` ${C.yellow}:${host.port}${C.reset}` : "";
  return `${arrow}${alias}${user}${hn}${port}`;
}

export async function selectHost(
  hosts: SshHost[],
  title = "Select SSH server",
): Promise<SshHost | null> {
  if (!process.stdin.isTTY) {
    console.error("Error: interactive selection requires a TTY.");
    process.exit(1);
  }

  if (hosts.length === 0) return null;

  return new Promise((resolve) => {
    let index = 0;
    let rendered = 0;

    const lines = () => [
      `${C.bold}  ${title}${C.reset} ${C.gray}(↑↓ navigate · Enter connect · q quit)${C.reset}`,
      "",
      ...hosts.map((h, i) => hostLine(h, i === index)),
      "",
    ];

    const render = () => {
      if (rendered > 0) process.stdout.write(C.up(rendered));
      const output = lines();
      rendered = output.length;
      for (const l of output) process.stdout.write(`${C.clearLine}${l}\n`);
    };

    const cleanup = () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write(C.cursorShow);
      if (rendered > 0) {
        process.stdout.write(C.up(rendered));
        for (let i = 0; i < rendered; i++)
          process.stdout.write(`${C.clearLine}\n`);
        process.stdout.write(C.up(rendered));
      }
    };

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    process.stdout.write(C.cursorHide);

    render();

    const onData = (key: string) => {
      if (key === "\x03" || key === "q") {
        process.stdin.off("data", onData);
        cleanup();
        resolve(null);
        return;
      }
      if (key === "\r") {
        process.stdin.off("data", onData);
        cleanup();
        resolve(hosts[index]);
        return;
      }
      if (key === "\x1b[A") {
        index = (index - 1 + hosts.length) % hosts.length;
        render();
        return;
      }
      if (key === "\x1b[B") {
        index = (index + 1) % hosts.length;
        render();
        return;
      }
    };

    process.stdin.on("data", onData);

    const onSigterm = () => {
      cleanup();
      process.exit(0);
    };
    process.once("SIGTERM", onSigterm);
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
): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const ask = () => {
      const hint = required
        ? `${C.gray}(required)${C.reset}`
        : `${C.gray}(optional, Enter to skip)${C.reset}`;
      rl.question(`${C.cyan}?${C.reset} ${question} ${hint}: `, (answer) => {
        const v = answer.trim();
        if (required && !v) {
          ask();
          return;
        }
        rl.close();
        resolve(v);
      });
    };

    ask();
  });
}
