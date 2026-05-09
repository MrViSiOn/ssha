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

export type Command = "connect" | "add" | "remove" | "list";

export interface CliArgs {
  command: Command;
  configPath: string;
  jsonOutput: boolean;
  help: boolean;
  version: boolean;
}
