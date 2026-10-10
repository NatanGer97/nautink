# ADR-002: Codex CLI as a second agent
- **Status:** Accepted
- **Date:** 2026-10-10

## Context
Nautink drives the user's own Claude Code CLI (`claude -p`) through the local server. Users who work
with OpenAI's Codex CLI cannot use the chat. Codex has a headless mode (`codex exec --json`) that
streams JSONL events, can resume a session (`codex exec resume <id>`), and takes extra instructions
through `-c developer_instructions=...`. It differs from Claude Code in four ways that matter here:

- It does not stream reply text token by token. Each agent message arrives whole (`item.completed`).
- It reports token usage, not a cost in USD.
- Its only way to read files is a shell. Read-only access is a sandbox (`sandbox_mode = "read-only"`),
  not a list of allowed tools.
- Its model names are OpenAI's, not `opus` / `sonnet` / `haiku`.

## Decision
- **Two agents: `claude` and `codex`.** The user picks one in Settings. The choice is a UI preference,
  remembered like the default model. Claude stays the default.
- **One chat contract.** `POST /api/chat` takes an `agent` field and streams the same `ChatEvent`s for
  both. The server picks the CLI, its arguments and its output parser by agent. Codex messages become
  one `delta` each; shell commands become `tool` steps. `done.costUsd` is `null` when the agent does not
  report a cost.
- **Models belong to an agent.** Each agent has its own model list, plus "Default" (the CLI's own
  default). Claude's list stays fixed (`opus`, `sonnet`, `haiku`). Codex's list is read from the
  installed CLI (`codex debug models`, entries with `visibility: "list"`) and served by
  `GET /api/models`, so the picker shows exactly what the user's Codex supports. A Claude model name
  sent with `agent: "codex"` (or the reverse) is a 400 error.
- **Codex runs read-only and lean.** Always `sandbox_mode = "read-only"`, `--ignore-user-config` and
  `--ignore-rules` (no user MCP servers, hooks or profiles, like Claude's `--setting-sources project`),
  `--skip-git-repo-check`. Without a codebase it runs in the same neutral work folder as Claude.
- **Health reports both CLIs.** `GET /api/health` gains a `codex` entry next to `claude`. `CODEX_BIN`
  sets the binary, like `CLAUDE_BIN`.
- **Sessions do not cross agents.** A diagram remembers which agent owns its session. After a switch,
  the next turn starts a new session.
- **The UI says the active agent's name** ("Ask Codex to fix", "Claude proposes 3 changes"). Replies
  and versions remember which agent wrote them.

## Consequences
- Codex replies appear in one step instead of streaming in. The working pill and tool steps still show
  progress.
- Codex replies show no cost.
- The `ChatEvent` contract stays the single place both agents must fit. A third agent is one more
  argument builder, parser and model list.
- Codex models need no list in the repo. `codex debug models` is a debug command and its shape may
  change; when it fails or does not parse, the Codex list is empty, the server logs why, and "Default"
  still works.
