import { createConnection } from "node:net";
import type { SshHost } from "./types.js";

export type HostStatus = "checking" | "up" | "down";

export function checkHost(
  host: SshHost,
  timeout = 3000,
): Promise<"up" | "down"> {
  return new Promise((resolve) => {
    const port = host.port ?? 22;
    const socket = createConnection({ host: host.hostname, port });

    const timer = setTimeout(() => {
      socket.destroy();
      resolve("down");
    }, timeout);

    socket.on("connect", () => {
      clearTimeout(timer);
      socket.destroy();
      resolve("up");
    });

    socket.on("error", () => {
      clearTimeout(timer);
      resolve("down");
    });
  });
}

export async function checkHostTimed(
  host: SshHost,
  timeout = 3000,
): Promise<{ status: "up" | "down"; ms: number }> {
  const start = Date.now();
  const status = await checkHost(host, timeout);
  return { status, ms: Date.now() - start };
}
