---
"@nautink/contracts": minor
"@nautink/server": minor
---

Add Codex CLI as a second agent (ADR-002). `POST /api/chat` takes an `agent` field (`claude` or `codex`, Claude when left out) and runs `codex exec` read-only for Codex, streaming the same SSE events; `done.costUsd` is `null` for Codex. `GET /api/health` reports both CLIs, `GET /api/models` lists each agent's models (Codex's from the installed CLI), and `CODEX_BIN` sets the Codex command.
