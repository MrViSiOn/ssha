# ssha

> Manage and connect to SSH servers from your terminal — fast.

A minimal TUI command built on top of `~/.ssh/config`. No extra config files, no daemons, no cloud accounts. Just your existing SSH setup, with a keyboard-driven interface.

```
ssha              → pick a server and connect
ssha multi        → open multiple servers in new windows/tabs
ssha add          → add a new server (wizard)
ssha edit         → edit an existing server
ssha copy         → copy ssh command to clipboard
ssha check        → test connectivity to all servers
ssha rm           → remove a server
ssha ls           → list all servers
```

## Demo

```
  Select SSH server  (↑↓ · Enter · Esc · q quit · f tunnel)
  / prod

› ● production  root@ → prod.example.com :2222  [web,prod]  2h ago
  ● prod-db     deploy@ → db.prod.internal       [db,prod]   1d ago
  · staging     root@ → 10.0.1.50               [web]       3d ago
```

Servers are sorted by **last used**, most recent first. Type to filter live — by alias, hostname, username, or tag. The status dot shows real-time TCP connectivity (`●` reachable, `●` unreachable, `·` checking).

## Install

```bash
npm install -g ssh-tui
```

Or run without installing:

```bash
npx ssh-tui
```

Requires **Node.js ≥ 22.6.0** and **OpenSSH** (`ssh` in PATH).

## Commands

### `ssha` — pick and connect

Opens an interactive list of your SSH servers. Navigate with `↑↓`, press `Enter` to connect, `q` or `Esc` to quit.

Start typing to filter in real time — the list narrows as you type across alias, hostname, username, and tags. `Esc` clears the filter; `Ctrl+C` always exits.

Last-used time is shown next to each server and the list is sorted by recency. If a server has port forwards configured, press `f` to connect with tunnels active.

The list scrolls automatically when there are more servers than fit on screen — `↑ N more` / `↓ N more` indicators show when items exist outside the visible window.

### `ssha multi` — open multiple connections

```
ssha multi
```

Same interface as `ssha`, but with multi-select: press `Space` to toggle servers on/off (`✓` marks selected entries), then `Enter` to open all selected servers simultaneously, each in a new terminal window or tab.

If you press `Enter` without selecting anything, it connects to the server under the cursor (same as `ssha`).

Supported terminal emulators:

| Platform | Primary | Fallback |
|----------|---------|---------|
| Windows | Windows Terminal (`wt`) | `start cmd /k` |
| macOS | iTerm2 | Terminal.app |
| Linux | tmux (if inside a session) | gnome-terminal → xterm → konsole |

### `ssha add` — add a server

```
$ ssha add

? Server alias (required): staging
? Hostname or IP (required): 10.0.1.50
? Username (optional, Enter to skip): deploy
? Port (default 22) (optional, Enter to skip): 2222
? Path to private key (IdentityFile) (optional, Enter to skip): ~/.ssh/id_ed25519
? Tags (comma-separated, e.g. prod,web) (optional, Enter to skip): web,staging
? Port forwards (e.g. 8080:localhost:80, 5432:db:5432) (optional, Enter to skip):

✓ Server 'staging' added to ~/.ssh/config
```

Appends a `Host` block to `~/.ssh/config`. Creates the file with permissions `600` if it does not exist. Tags and port forwards are stored as comments inside the block and parsed back transparently.

### `ssha edit` — edit a server

Opens the interactive list, select a server, and update any of its fields — hostname, user, port, identity key, tags, or port forwards. Leave a field blank to keep the current value.

### `ssha copy` — copy ssh command

```bash
ssha copy             # pick from the list
ssha copy my-server   # copy directly for a specific alias
```

Copies `ssh <alias>` to the clipboard. Works on macOS (`pbcopy`), Windows (`clip`), and Linux (`xclip` / `xsel` / `wl-copy`).

### `ssha check` — test connectivity

```
$ ssha check

  Checking 4 servers...

  ●  production  prod.example.com:22     OK           (42ms)
  ●  staging     10.0.1.50:2222          OK           (87ms)
  ●  db          db.internal:22          UNREACHABLE  (3001ms)
  ●  old-vps     1.2.3.4:22             UNREACHABLE  (3001ms)

  Summary: 2 reachable · 2 unreachable
```

Tests TCP connectivity to every server in parallel. Exits with code `1` if any server is unreachable.

### `ssha rm` — remove a server

Opens the interactive list. Select a server, confirm, and its `Host` block is removed from `~/.ssh/config`. All other blocks are left untouched.

### `ssha ls` — list servers

```
$ ssha ls

ALIAS       HOSTNAME              USER    PORT  KEY  TAGS
---------------------------------------------------------
production  prod.example.com      root    2222  ✓    web,prod
staging     10.0.1.50             deploy  2222  ✓    web,staging
db          db.internal           -       22    -    db,prod
```

```bash
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
| `--json` | JSON output (`ls` only) |
| `-v, --version` | Show version |
| `-h, --help` | Show help |

## Port forwarding

Port forwards can be configured per server via `ssha add` or `ssha edit`:

```
? Port forwards (e.g. 8080:localhost:80, 5432:db:5432): 5432:localhost:5432
```

In the connect TUI, a server with tunnels shows an `f tunnel` hint in the header. Press `f` to connect with all port forwards active (`ssh -L ...`).

## Security

- **Private keys are never read or displayed.** ssha writes the key path to `~/.ssh/config` and delegates all authentication to the system `ssh` client — it never touches key files.
- `ssha ls` and `--json` output show only whether a key is configured (`✓` / `true`), not the path.
- `~/.ssh/config` is created with permissions `600` if it does not exist.
- ssha spawns the native `ssh` binary — it does not implement SSH itself.
- Usage history is stored locally at `~/.config/ssha/history.json` (timestamps only, no credentials).

## Compatibility

macOS, Linux, and Windows. Interactive commands require a TTY.

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
