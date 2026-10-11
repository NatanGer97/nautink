# @nautink/contracts

## 0.1.0

### Minor Changes

- ab08618: Add the Zod schemas for the server API (chat request, info, health, repo) and the chat SSE events, with an encoder and a streaming decoder.
- f07f71c: `ChatSelection` gets an optional `kinds` list (`node`, `link`, `class` …) beside `ids` and `labels`, so the server can say what each selected item is. Requests without it stay valid.
- 9b17976: Add Codex CLI as a second agent (ADR-002). `POST /api/chat` takes an `agent` field (`claude` or `codex`, Claude when left out) and runs `codex exec` read-only for Codex, streaming the same SSE events; `done.costUsd` is `null` for Codex. `GET /api/health` reports both CLIs, `GET /api/models` lists each agent's models (Codex's from the installed CLI), and `CODEX_BIN` sets the Codex command. A `sessionId` must not start with `-`, so it can never be read as a CLI flag.

### Patch Changes

- 23a1c74: Declare the MIT license in every package.
