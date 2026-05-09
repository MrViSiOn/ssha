# ssha

> Manage and connect to SSH servers from your terminal — fast.

A minimal TUI command built on top of `~/.ssh/config`. No extra config files, no daemons, no cloud accounts. Just your existing SSH setup, with a keyboard-driven interface.

```
ssha              → pick a server and connect
ssha add          → add a new server (wizard)
ssha rm           → remove a server
ssha ls           → list all servers
```

## Demo

```
  Select SSH server  (↑↓ · Enter · Esc clear · q quit)
  / prod

› production  root@ → prod.example.com :2222  2h ago
  prod-db     deploy@ → db.prod.internal      1d ago
```

Servers are sorted by **last used**, most recent first. Type to filter live — by alias, hostname, or username. Press Enter to connect.

## Install

```bash
npm install -g ssha
```

Or run without installing:

```bash
npx ssha
```

Requires **Node.js ≥ 22.6.0** and **OpenSSH** (`ssh` in PATH).

## Commands

### `ssha` — pick and connect

Opens an interactive list of your SSH servers. Navigate with `↑↓`, press `Enter` to connect, `q` or `Esc` to quit.

Start typing to filter in real time — the list narrows as you type. `Esc` clears the filter; `Ctrl+C` always exits.

Last-used time is shown next to each server and the list is sorted by recency so your most-used servers are always at the top.

### `ssha add` — add a server

```
$ ssha add

? Server alias (required): staging
? Hostname or IP (required): 10.0.1.50
? Username (optional, Enter to skip): deploy
? Port (default 22) (optional, Enter to skip): 2222
? Path to private key (IdentityFile) (optional, Enter to skip): ~/.ssh/id_ed25519

✓ Server 'staging' added to /Users/you/.ssh/config
```

Appends a `Host` block to `~/.ssh/config`. Creates the file with permissions `600` if it does not exist.

### `ssha rm` — remove a server

Opens the same interactive list. Select a server, confirm deletion, and its `Host` block is removed from `~/.ssh/config`. All other blocks are left untouched.

### `ssha ls` — list servers

```
$ ssha ls

ALIAS       HOSTNAME              USER    PORT  KEY
----------------------------------------------------
production  prod.example.com      root    2222  ✓
staging     10.0.1.50             deploy  2222  ✓
db          db.internal           -       22    -
```

```bash
# Machine-readable output
ssha ls --json
```

```json
[
  {
    "alias": "production",
    "hostname": "prod.example.com",
    "user": "root",
    "port": 2222,
    "identityFile": true
  }
]
```

### Options

| Flag | Description |
|------|-------------|
| `--config <path>` | Use an alternative SSH config file |
| `--json` | JSON output (list command only) |
| `-v, --version` | Show version |
| `-h, --help` | Show help |

## Security

- **Private keys are never read or displayed.** ssha writes the key path to `~/.ssh/config` and delegates all authentication to the system `ssh` client — it never touches key files.
- `ssha ls` and `--json` output show only whether a key is configured (`✓` / `true`), not the path.
- `~/.ssh/config` is created with permissions `600` if it does not exist.
- ssha spawns the native `ssh` binary — it does not implement SSH itself.
- Usage history is stored locally at `~/.config/ssha/history.json` (timestamps only, no credentials).

## Compatibility

macOS and Linux. Interactive commands (`ssha`, `ssha add`, `ssha rm`) require a TTY.

## Development

```bash
git clone https://github.com/MrViSiOn/ssha.git
cd ssha
pnpm install
pnpm build          # compile TypeScript → dist/
pnpm dev            # run directly with tsx (no build step)
pnpm test           # run tests
pnpm lint           # oxlint
pnpm fmt            # prettier
pnpm hooks:install  # register git pre-commit hook
```

## License

MIT © [MrViSiOn](https://github.com/MrViSiOn)
