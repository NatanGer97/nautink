# @nautink/server

## 0.1.0

### Minor Changes

- 097652a: Add `POST /api/chat`: runs the local Claude Code CLI with v1's lean flags and streams its reply as SSE events (`session`, `delta`, `turn`, `tool`, `done`, `error`). A canvas selection is added to the prompt so Claude limits its change to the selected nodes and their direct links.
- 9b17976: Add Codex CLI as a second agent (ADR-002). `POST /api/chat` takes an `agent` field (`claude` or `codex`, Claude when left out) and runs `codex exec` read-only for Codex, streaming the same SSE events; `done.costUsd` is `null` for Codex. `GET /api/health` reports both CLIs, `GET /api/models` lists each agent's models (Codex's from the installed CLI), and `CODEX_BIN` sets the Codex command. A `sessionId` must not start with `-`, so it can never be read as a CLI flag.
- 471c22b: Refuse requests whose Host header is not localhost, 127.0.0.1 or [::1] (DNS rebinding), run the Claude CLI from an empty folder when no codebase is selected, and bump the system prompt to version 2 (Mermaid 12).
- e458e25: Add the local server: config from the environment, `GET /api/info`, `GET /api/health` (is the Claude Code CLI installed) and `POST /api/repo` (choose the codebase folder Claude may read, restricted to folders inside your home folder).
- bcdc9ce: Run Claude with no settings loaded, so a chosen codebase's `.claude/settings.json` hooks (and its `CLAUDE.md`) never apply, and require `REPO_DIR` to be inside the home folder like a folder chosen in the app.
- b6daed7: Clearer selection prompt (PRD §4.1): the selection block names each item's kind when the client sends it, tells Claude to keep every other line byte-identical, and to find editor-only ids (links, messages, notes) by their label. The system prompt (version 3) adds the same rule.
- 4632dcf: Serve the built web app from `apps/web/dist` when `NODE_ENV=production`, with `index.html` for client-side routes.
- ddb9002: `startServer` takes an optional `webDistDir`: the server serves that folder whatever `NODE_ENV` says, and refuses one without an `index.html`. The package exports `./server` and `./logger` for the `nautink` command.

### Patch Changes

- 23a1c74: Declare the MIT license in every package.
- 2a49c6b: Simplify error handling around `--version`, the JSON body parser and `listen`, and hold the server to full line, statement and function coverage.
- Updated dependencies [ab08618]
- Updated dependencies [f07f71c]
- Updated dependencies [23a1c74]
- Updated dependencies [9b17976]
  - @nautink/contracts@0.1.0
