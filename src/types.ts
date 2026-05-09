export interface SshHost {
  alias: string;
  hostname: string;
  user?: string;
  port?: number;
  hasIdentityFile: boolean;
}

export interface AddOptions {
  alias: string;
  hostname: string;
  user?: string;
  port?: number;
  identityFilePath?: string;
}

export type Command = "connect" | "add" | "remove" | "list" | "edit" | "copy";

export interface EditOptions {
  hostname: string;
  user: string | null;
  port: number | null;
  identityFilePath?: string | null;
}

export interface CliArgs {
  command: Command;
  configPath: string;
  jsonOutput: boolean;
  help: boolean;
  version: boolean;
  target?: string;
}
