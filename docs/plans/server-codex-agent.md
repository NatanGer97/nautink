issue: none

# Server: run Codex CLI as a second agent

## Context

The server only drives `claude -p`. ADR-002 adds OpenAI's Codex CLI as a second agent behind the same
`POST /api/chat` contract. This plan is the server and contract half; `web-codex-agent.md` is the UI
half and depends on it.

Codex event format, checked on codex-cli 0.154 (`codex exec --json`):
`thread.started{thread_id}`, `turn.started`, `item.started|item.completed{item}` where `item.type` is
`agent_message{text}` or `command_execution{command,exit_code,status}` (others ignored),
`turn.completed{usage}`, `turn.failed{error.message}`.

_Untracked — no issue. Progress lives in this file's checkboxes. `/new-issue docs/plans/server-codex-agent.md` adopts it later._

## Target

`POST /api/chat` with `agent: "codex"` runs `codex exec --json` read-only and streams the same
`ChatEvent`s as Claude; `GET /api/health` reports both CLIs; `GET /api/models` lists each agent's models.

## Out of scope

- Any UI change (agent picker, names, model chip): `web-codex-agent.md`.
- Token-by-token streaming for Codex (the CLI does not offer it).
- Showing Codex token usage.

## Tasks

- [x] **T1 — Agent ids and per-agent models in contracts**
  - context - one source for agent ids, labels, CLI names and model lists
  - Files: `packages/contracts/src/agents.ts` (new), `packages/contracts/src/models.ts`, `packages/contracts/src/models.test.ts` (new), `packages/contracts/package.json` (export)
  - Red: tests for `AGENT_IDS` (`claude`, `codex`), `AGENT_LABELS` (`Claude`, `Codex`), `AGENT_CLI_NAMES` (`Claude Code`, `Codex CLI`); `codexModelSchema` accepts `gpt-6-astra`, rejects `opus`, `''` and `a b`; `modelsResponseSchema` parses `{ claude: [{id,label}], codex: [] }`; fail on missing module
  - Green: add `agents.ts`; in `models.ts` keep `MODEL_IDS` (Claude, fixed) and add `ModelOption {id,label}`, `CLAUDE_MODEL_OPTIONS`, `codexModelSchema` (slug pattern `^[a-z0-9][a-z0-9._-]*$`, not a Claude id), `ModelsResponse` for `GET /api/models`; `API_ROUTES.models`
  - Verify: `pnpm --filter @nautink/contracts test`
  - Acceptance: agents, model options and the models response importable from `@nautink/contracts`

- [ ] **T2 — `agent` on `ChatRequest`, nullable `costUsd`, `codex` in health**
  - context - additive contract change; web keeps compiling
  - Files: `packages/contracts/src/chat.ts`, `packages/contracts/src/chat.test.ts`, `packages/contracts/src/server-info.ts`, its test
  - Red: `chatRequestSchema` parses `agent: 'codex'`; missing `agent` parses as `'claude'` (older clients); `agent: 'gpt'` fails; `model: 'opus'` with `agent: 'codex'` fails with message `model "opus" does not belong to agent "codex"`; `done` with `costUsd: null` parses; health with `codex` entry parses
  - Green: `agent: AgentId` (default `'claude'`); `model: string | null` checked by agent (Claude → `MODEL_IDS`, Codex → `codexModelSchema`); `costUsd: number | null`; `HealthResponse.codex` with same shape as `claude`
  - Verify: `pnpm --filter @nautink/contracts test && pnpm typecheck`
  - Acceptance: contract tests green, `pnpm typecheck` green across the monorepo

- [ ] **T3 — Generic CLI run**
  - context - `claude-run.ts` hard-codes the stream-json parser and the name `claude` in exit messages
  - Files: `apps/server/src/cli-run.ts` (renamed from `claude-run.ts`), `apps/server/src/cli-run.test.ts`, `apps/server/src/chat-route.ts`
  - Red: test that a run with a custom `parseLine` emits its events, and that an exit without result says `codex exited with code 2` when `bin` is `codex`; an `error` event from the parser ends the run with no second error
  - Green: `startCliRun({ bin, args, cwd, prompt, parseLine, emit, onEnd })`; exit text uses the bin's base name; parser `error` counts as the end
  - Verify: `pnpm --filter @nautink/server test`
  - Acceptance: Claude chat tests unchanged and green

- [ ] **T4 — Codex output parser**
  - context - map Codex JSONL to `ChatEvent`s
  - Files: `apps/server/src/codex-json.ts` (new), `apps/server/src/codex-json.test.ts`
  - Red: tests per event: `thread.started` → `session{sessionId, model}` (model = requested or `default`); first `agent_message` → `delta`; later ones → `turn` + `delta`; `command_execution` started → `tool{label:"Run rg --files"}` (unwraps `/bin/zsh -lc "…"`, clips to 80 chars); `turn.completed` → `done{text: last message, durationMs from injected clock, costUsd: null, isError:false}`; `turn.failed` → `error{message}`; top-level `error` (reconnect notice), reasoning items, non-JSON lines → nothing
  - Green: `createCodexParser({ model, now })` returning `parseLine(line): ChatEvent[]`; zod schemas as in `stream-json.ts`
  - Verify: `pnpm --filter @nautink/server test`
  - Acceptance: every case above covered

- [ ] **T5 — Codex arguments and agent-aware system prompt**
  - context - headless, read-only, lean Codex run; prompt names the right read tool
  - Files: `apps/server/src/codex-args.ts` (new), `apps/server/src/codex-args.test.ts`, `apps/server/src/prompt.ts`, `apps/server/src/prompt.test.ts`
  - Red: new run → `['exec','--json','--skip-git-repo-check','--ignore-user-config','--ignore-rules','-c','sandbox_mode="read-only"','-c','developer_instructions=<JSON-quoted prompt>', …model, '-']`; resume → `['exec','resume', …same flags…, sessionId, '-']`; `-m` only when a model is set; `buildSystemPrompt(true,'codex')` has a rule about read-only shell commands (`rg`, `cat`, `ls`) and not Read/Grep/Glob; `buildSystemPrompt(false,'codex')` tells it not to run commands; Claude prompt text unchanged
  - Green: `buildCodexArgs({ sessionId, model, isRepoAware })`; `buildSystemPrompt(isRepoAware, agent)`; bump `SYSTEM_PROMPT_VERSION` to 4
  - Verify: `pnpm --filter @nautink/server test`
  - Acceptance: args match a manual run that works (`codex exec … -`), checked once by hand and noted in the PR

- [ ] **T6 — `CODEX_BIN` config and Codex in health**
  - context - same pattern as `CLAUDE_BIN`
  - Files: `apps/server/src/config.ts`, `config.test.ts`, `apps/server/src/health.ts`, `health.test.ts`, `apps/server/src/info-routes.ts`, `info-routes.test.ts`, `apps/server/src/app.ts`, `apps/server/src/server.ts`
  - Red: `CODEX_BIN` defaults to `codex`, empty string is an error; `parseVersion('codex-cli 0.154.0') === '0.154.0'`; ENOENT says `"codex" was not found. Install Codex CLI or set CODEX_BIN.`; `GET /api/health` returns both entries, checked in parallel
  - Green: generic `checkCli(bin, cliName, envVar, timeoutMs)`; health route runs both
  - Verify: `pnpm --filter @nautink/server test`
  - Acceptance: `curl /api/health` shows `claude` and `codex`

- [ ] **T7 — `GET /api/models` lists the installed Codex models**
  - context - user wants the picker to show the models the local Codex supports
  - Files: `apps/server/src/models.ts` (new), `apps/server/src/models.test.ts`, `apps/server/src/info-routes.ts`, `info-routes.test.ts`, `apps/server/tests/fake-codex.ts`
  - Red: `parseCodexModels(json)` keeps only `visibility: "list"` entries as `{id: slug, label: display_name}` in catalog order; bad JSON or unknown shape throws with a clear message; route returns `{ claude: CLAUDE_MODEL_OPTIONS, codex: [...] }`; when `codex debug models` fails or does not parse, `codex: []` and the reason is logged
  - Green: run `<codexBin> debug models` without a shell (timeout as health); parse with zod
  - Verify: `pnpm --filter @nautink/server test`
  - Acceptance: `curl /api/models` lists this machine's Codex models

- [ ] **T8 — Chat route picks the agent**
  - context - wire T3–T6 together
  - Files: `apps/server/src/chat-route.ts`, `apps/server/src/chat-route.test.ts`, `apps/server/tests/fake-codex.ts` (new), `apps/server/tests/test-server.ts`
  - Red: with a fake Codex (scenarios `reply`, `tool`, `failed`, `crash`, `hang`), `agent:'codex'` streams `session → delta → done`, tool steps, `error` on `turn.failed`, `error` with stderr on crash, kill on client close; resume passes the session id; repo-aware run uses the repo dir as cwd; `agent` missing still runs Claude
  - Green: route chooses bin, args and parser by `request.agent`
  - Verify: `pnpm --filter @nautink/server test`
  - Acceptance: both agents covered end to end through HTTP

- [ ] **T9 — Docs and changeset**
  - context - PRD and README name only Claude
  - Files: `docs/PRD.md` (§2 non-goals, §3.1, §7.4 health), `README.md` (requirements, `CODEX_BIN`, diagram), `.changeset/server-codex-agent.md`
  - Red: n/a (docs) — `pnpm format:check` is the check
  - Green: say Nautink drives Claude Code or Codex CLI; document `CODEX_BIN`; link ADR-002
  - Verify: `pnpm format:check && pnpm check`
  - Acceptance: gate green

## Definition of done

The items in [`docs/plans/README.md`](README.md), plus this plan's acceptance criteria.

## Open questions

Resolved with the user: ignore user config (`--ignore-user-config`); Codex models come from the
installed CLI (T7).

1. Non-repo mode: Codex still has a read-only shell in the neutral temp folder (cannot be removed, only
   told not to use it). Acceptable?
