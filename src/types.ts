export interface SshHost {
  alias: string;
  hostname: string;
  user?: string;
  port?: number;
  hasIdentityFile: boolean;
  tags: string[];
}

export interface AddOptions {
  alias: string;
  hostname: string;
  user?: string;
  port?: number;
  identityFilePath?: string;
  tags?: string[];
}

export type Command = "connect" | "add" | "remove" | "list" | "edit" | "copy";

export interface EditOptions {
  hostname: string;
  user: string | null;
  port: number | null;
  identityFilePath?: string | null;
  tags: string[];
}

export interface CliArgs {
  command: Command;
  configPath: string;
  jsonOutput: boolean;
  help: boolean;
  version: boolean;
  target?: string;
}
