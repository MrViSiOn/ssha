import { spawnSync } from "node:child_process";

function tryOpen(cmd: string, args: string[]): boolean {
  const r = spawnSync(cmd, args, { stdio: "ignore", windowsHide: false });
  return r.error === undefined && r.status === 0;
}

export function openInNewWindow(alias: string): boolean {
  if (process.platform === "win32") {
    if (tryOpen("wt", ["new-tab", "--", "ssh", alias])) return true;
    spawnSync(
      "cmd",
      ["/c", "start", `SSH - ${alias}`, "cmd", "/k", `ssh ${alias}`],
      {
        stdio: "ignore",
        windowsHide: false,
      },
    );
    return true;
  }

  if (process.platform === "darwin") {
    const sshCmd = `ssh ${alias}`;
    if (
      tryOpen("osascript", [
        "-e",
        `tell application "iTerm2" to create window with default profile command "${sshCmd}"`,
      ])
    )
      return true;
    return tryOpen("osascript", [
      "-e",
      `tell application "Terminal" to do script "${sshCmd}"`,
    ]);
  }

  if (process.env["TMUX"]) {
    if (tryOpen("tmux", ["new-window", "-n", alias, `ssh ${alias}`]))
      return true;
  }
  if (tryOpen("gnome-terminal", ["--title", alias, "--", "ssh", alias]))
    return true;
  if (tryOpen("xterm", ["-title", alias, "-e", `ssh ${alias}`])) return true;
  if (tryOpen("konsole", ["--new-tab", "-e", `ssh ${alias}`])) return true;
  if (tryOpen("xfce4-terminal", ["--title", alias, "-e", `ssh ${alias}`]))
    return true;

  return false;
}
