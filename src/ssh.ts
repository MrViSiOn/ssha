import { spawn } from "node:child_process";
import type { Tunnel } from "./types.js";

export function connect(alias: string, tunnels: Tunnel[] = []): void {
  const forwardArgs = tunnels.flatMap((t) => [
    "-L",
    `${t.localPort}:${t.remoteHost}:${t.remotePort}`,
  ]);
  const proc = spawn("ssh", [...forwardArgs, alias], {
    stdio: "inherit",
    shell: false,
  });

  proc.on("error", (err) => {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      console.error("Error: ssh not found. Please install OpenSSH.");
    } else {
      console.error(`Error: ${err.message}`);
    }
    process.exit(1);
  });

  proc.on("close", (code) => {
    process.exit(code ?? 0);
  });
}
