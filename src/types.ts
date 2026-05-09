export interface Tunnel {
  localPort: number;
  remoteHost: string;
  remotePort: number;
}

export interface SshHost {
  alias: string;
  hostname: string;
  user?: string;
  port?: number;
  hasIdentityFile: boolean;
  tags: string[];
  tunnels: Tunnel[];
}

export interface AddOptions {
  alias: string;
  hostname: string;
  user?: string;
  port?: number;
  identityFilePath?: string;
  tags?: string[];
  tunnels?: Tunnel[];
}

export type Command = "connect" | "add" | "remove" | "list" | "edit" | "copy";

export interface EditOptions {
  hostname: string;
  user: string | null;
  port: number | null;
  identityFilePath?: string | null;
  tags: string[];
  tunnels: Tunnel[];
}

export interface CliArgs {
  command: Command;
  configPath: string;
  jsonOutput: boolean;
  help: boolean;
  version: boolean;
  target?: string;
}
