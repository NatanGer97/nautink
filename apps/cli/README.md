# nautink

The published package: one command that starts the Nautink server with the built web app and opens
it in your browser.

```bash
npx nautink
```

| Option            | What                                                   |
| ----------------- | ------------------------------------------------------ |
| `--port <number>` | Port on 127.0.0.1 (default: `API_PORT`, or 8791)       |
| `--no-open`       | Do not open the browser (for SSH or a container)       |
| `-h`, `--help`    | Show the options                                       |
| `-v`, `--version` | Show the version                                       |

| Variable     | Default  | What                                                                         |
| ------------ | -------- | ---------------------------------------------------------------------------- |
| `API_PORT`   | `8791`   | Port on 127.0.0.1, when `--port` is not given                                |
| `CLAUDE_BIN` | `claude` | The Claude Code CLI to run                                                   |
| `CODEX_BIN`  | `codex`  | The Codex CLI to run when you pick Codex                                     |
| `REPO_DIR`   | none     | A codebase the agent may read at startup (repo-aware mode); inside your home |

An unknown option, a bad port or a port already in use stops the command with a message and exit
code 1. If no browser can be opened, it prints the URL to open yourself and keeps running.

## How it is built

`pnpm --filter nautink build` (run by `pnpm build` after the web app) writes `dist/`:

- `cli.js`: `src/cli.ts`, the server and the workspace packages bundled by esbuild into one ESM
  file. Node will not strip types inside `node_modules`, so the package ships JavaScript. `express`
  and `zod` stay external and are this package's `dependencies`.
- `web/`: a copy of `apps/web/dist`.

`pnpm check:pack` (repo root) packs this package, installs the tarball with npm into an empty folder,
runs the installed `nautink` and checks it serves the app and the API.
