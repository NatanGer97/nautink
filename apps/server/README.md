# @nautink/server

The local Node bridge between the web app and your Claude Code CLI (PRD §7.4). It listens on
`127.0.0.1:8791` only and runs `claude -p` for each `POST /api/chat`, streaming the reply back as SSE.

```bash
pnpm --filter @nautink/server dev      # restarts on change
pnpm --filter @nautink/server start
```

| Variable | Default | What |
|---|---|---|
| `API_PORT` | `8791` | Port on 127.0.0.1 |
| `CLAUDE_BIN` | `claude` | The Claude Code CLI to run |
| `REPO_DIR` | none | A codebase Claude may read at startup (repo-aware mode); must be inside your home folder |

The prompt Claude gets is built in `src/prompt.ts` (`SYSTEM_PROMPT_VERSION`, `buildPrompt`). A
canvas selection adds a block that lists the selected items (kind, id, label) and tells Claude to
change only them and their direct links, keeping every other line byte-identical (PRD §4.1).

## Selection check (PRD §4.1 "done when")

`scripts/selection-check.ts` sends ten scripted flowchart prompts, each with a selection, to a
running server, parses each reply with Mermaid's parser and checks that only the selected nodes and
their direct links changed (`scripts/selection-scope.ts` says exactly what counts). It prints one
line per prompt and a score; it exits non-zero below 9 of 10.

It calls real Claude, so it is not part of `pnpm check` or CI. Run it by hand after changing the
prompt:

```bash
API_PORT=8795 pnpm --filter @nautink/server start                         # terminal 1
node apps/server/scripts/selection-check.ts --url http://127.0.0.1:8795 --model sonnet  # terminal 2
```

`--model` is `opus`, `sonnet` or `haiku`; leave it out for the CLI's default. The checker itself is
covered by `tests/selection-scope.test.ts`, which runs in `pnpm check` with fixed diagrams.
