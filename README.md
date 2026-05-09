# assh

A fast TUI command to manage and connect to SSH servers defined in `~/.ssh/config`.

```
assh              pick and connect to a server
assh add          add a new server
assh rm           remove a server
assh ls           list all configured servers
```

## Install

```bash
npm install -g assh
```

Or run without installing:

```bash
npx assh
```

## Usage

### Connect to a server

```
$ assh

  Select SSH server (↑↓ navigate · Enter connect · q quit)

› web1 ubuntu@ → 192.168.1.10
  db   postgres@ → db.internal
  prod → prod.example.com :2222
```

Use arrow keys to navigate, Enter to connect, `q` to quit.

### Add a server

```
$ assh add

? Server alias (required): my-server
? Hostname or IP (required): 10.0.0.5
? Username (optional, Enter to skip): deploy
? Port (default 22) (optional, Enter to skip): 
? Path to private key (IdentityFile) (optional, Enter to skip): ~/.ssh/id_ed25519

✓ Server 'my-server' added to /Users/you/.ssh/config
```

### Remove a server

```
$ assh rm

  Select server to remove (↑↓ navigate · Enter connect · q quit)

› web1
  db

? Remove 'web1' (192.168.1.10)? (y/N) y
✓ Server 'web1' removed.
```

### List servers

```
$ assh ls

ALIAS     HOSTNAME        USER      PORT  KEY
-------------------------------------------------
web1      192.168.1.10    ubuntu    22    -
db        db.internal     postgres  22    ✓
prod      prod.example.com  -       2222  ✓

$ assh ls --json
[
  {
    "alias": "web1",
    "hostname": "192.168.1.10",
    "user": "ubuntu",
    "port": 22,
    "identityFile": false
  },
  ...
]
```

### Use an alternative config file

```bash
assh --config ~/work/.ssh/config
assh ls --config ~/work/.ssh/config
```

## Security

- **Private keys are never read or displayed.** assh only records the path to your key in `~/.ssh/config` and delegates all authentication to your system's `ssh` client.
- The `KEY` column in `assh ls` shows only whether a key is configured (`✓` or `-`), never the path.
- JSON output (`--json`) uses a boolean `identityFile` field, never the actual path.
- `~/.ssh/config` is created with permissions `600` if it does not exist.
- assh spawns the native `ssh` binary — it does not implement SSH itself.

## Requirements

- Node.js >= 22.6.0
- OpenSSH (`ssh` command available in PATH)

## Compatibility

macOS and Linux. Requires a TTY for interactive commands (`connect`, `add`, `remove`).

## License

MIT
