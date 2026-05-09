# ssha — SSH Server Manager

TUI command to manage and connect to SSH servers defined in `~/.ssh/config`.

## Setup & development

```bash
pnpm install
pnpm build        # compile TypeScript → dist/
pnpm dev          # run directly with tsx (no build needed)
pnpm test         # run tests
pnpm lint         # oxlint
pnpm fmt          # prettier format
pnpm fmt:check    # check formatting (used in CI/pre-commit)
pnpm hooks:install  # register git hooks
```

## Project structure

| File | Purpose |
|------|---------|
| `src/types.ts` | Shared TypeScript interfaces |
| `src/parser.ts` | Parse and write `~/.ssh/config` |
| `src/tui.ts` | Interactive terminal UI (raw stdin, no dependencies) |
| `src/ssh.ts` | Spawn native `ssh` process |
| `src/main.ts` | CLI entry: arg parsing, command dispatch |
| `index.mjs` | Binary entry point (imports `dist/main.js`) |

## Commands

```
ssha              → interactive server picker → connect
ssha add          → wizard to add a server to config
ssha rm           → pick and remove a server
ssha ls           → list all servers (--json for JSON output)
ssha --config <f> → use alternative SSH config file
```

## Security invariants — NEVER violate

1. **Never read** the contents of any `IdentityFile`
2. **Never display** the `IdentityFile` path to the user — only `hasIdentityFile: boolean`
3. **Never log** key paths or credentials anywhere
4. When creating `~/.ssh/config` from scratch, use mode `0o600`
5. `ssh.ts` only spawns `ssh <alias>` — never constructs identity flags itself
6. No `eval()` or dynamic code execution anywhere

## Code conventions

- Functional style — no classes
- `camelCase` for functions/variables, `PascalCase` for types/interfaces
- `.js` extensions in imports within `src/` (tsc compatibility)
- No comments unless the WHY is non-obvious
- Strict TypeScript — no implicit `any`
