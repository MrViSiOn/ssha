import { spawn } from "node:child_process";

export function connect(alias: string): void {
  const proc = spawn("ssh", [alias], { stdio: "inherit", shell: false });

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
