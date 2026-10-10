issue: none

# Web: choose Claude or Codex, and name the active agent

## Context

After `server-codex-agent.md`, the server can run Codex, but the web app always sends Claude requests
and says "Claude" everywhere (about 45 user-facing strings). ADR-002: the user picks the agent in
Settings, the model chip lists that agent's models, sessions do not cross agents, and the UI uses the
active agent's name. Replies and versions remember which agent wrote them.

Depends on `server-codex-agent.md` being landed.

_Untracked — no issue. Progress lives in this file's checkboxes. `/new-issue docs/plans/web-codex-agent.md` adopts it later._

## Target

A user picks Codex in Settings, chats, and sees Codex replies, statuses and reviews named "Codex".

## Out of scope

- Server and contract changes (other plan).
- A per-diagram agent choice.
- Renaming stored identifiers such as `VersionKind 'claude'` (kept for v1 backup compatibility).

## Tasks

- [x] **T1 — Records remember the agent**
  - context - attribution and session ownership survive reloads and backups
  - Files: `packages/storage/src/records.ts`, `packages/storage/src/backup-v1.ts`, tests in `packages/storage/src/`
  - Red: `ChatMessage.agent`, `Version.agent` and `Diagram.sessionAgent` round-trip through a backup; a backup without them still imports; an unknown agent value fails the backup with a clear error
  - Green: optional `agent?: AgentId` on `ChatMessage` and `Version`, `sessionAgent?: AgentId` on `Diagram`; missing means `claude`
  - Verify: `pnpm --filter @nautink/storage test`
  - Acceptance: old backups import unchanged

- [x] **T2 — Agent preference in the UI store**
  - context - remembered like `defaultModel`
  - Files: `apps/web/src/state/ui-prefs.ts`, `apps/web/src/state/ui-store.ts`, their tests
  - Red: default agent is `claude`; saved prefs without `agent` keep the rest; `setAgent('codex')` resets `defaultModel` to `null`; saved `agent:'claude'` with `defaultModel:'gpt-6-astra'` falls back to `null`
  - Green: `agent: AgentId` pref, `setAgent` action; `defaultModel: string | null` checked with the request's per-agent model rule from contracts
  - Verify: `pnpm --filter @nautink/web test`
  - Acceptance: switching agent never leaves an invalid model selected

- [x] **T3 — Requests carry the agent; sessions stay with their agent**
  - context - a Claude session id must not be sent to Codex
  - Files: `apps/web/src/chat/chat-turn.ts`, `apps/web/src/chat/turn-messages.ts`, `apps/web/src/chat/chat-client.ts`, `apps/web/src/workspace/field-actions.ts`, `apps/web/src/workspace/workspace-state.ts`, tests
  - Red: request body has `agent`; a diagram whose `sessionAgent` is `claude` sends `sessionId: null` when the agent is `codex`; the new session id is stored with `sessionAgent: 'codex'`; the assistant message and the version created on accept store `agent`; `done.costUsd: null` keeps `meta.costUsd` null
  - Green: read agent from the UI store at turn start; pass it through
  - Verify: `pnpm --filter @nautink/web test`
  - Acceptance: switching agent mid-chat starts a fresh session on the next turn

- [x] **T4 — Settings: agent picker, per-agent connection and model list**
  - context - M8 settings
  - Files: `apps/web/src/settings/settings-fields.tsx`, `apps/web/src/settings/connection-row.tsx`, `apps/web/src/settings/health.ts`, `apps/web/src/settings/use-connection-status.ts`, `apps/web/src/settings/models.ts` (new, fetch `GET /api/models`), `apps/web/src/chat/model-chip.tsx`, `apps/web/src/chat/chat-commands.ts` (⌘K model commands), tests
  - Red: Settings shows an "Agent" control (Claude / Codex); the connection row title is `Claude Code` or `Codex CLI` and its status comes from `health[agent]`; missing Codex shows the server's error; the default model select and the model chip list `Default` plus the selected agent's models from `/api/models`; an empty Codex list shows only `Default`; ⌘K "Switch to …" commands list the agent's models; a remembered Codex model missing from the list resets to `Default`
  - Green: `AgentField` (ToggleGroup like Appearance); `toConnectionStatus(health, agent)`; `useModelOptions(agent)` fetches once per session
  - Verify: `pnpm --filter @nautink/web test`
  - Acceptance: picking Codex changes the connection row and both model lists

- [x] **T5 — Agent name helper; chat strings**
  - context - one helper, then replace strings area by area
  - Files: `apps/web/src/chat/agent-name.ts` (new, `useAgentName()`, `agentName(agent)`), `chat/chat-message.tsx`, `chat-turn.ts`, `chat-store.ts`, `chat-composer.tsx`, `send-chat.ts`, `prompt-bar.tsx`, `quick-action-chips.tsx`, `working-pill.tsx`, `turn-proposal.ts`, `chat-reply.ts`, `auto-fix.ts`, `chat-commands.ts`, `turn-versions.ts`, tests
  - Red: with agent `codex`: placeholder `Ask Codex to change this diagram…`, pill `Codex is editing`, announcements `Codex replied.`, command `Stop Codex`; an old assistant message without `agent` is labelled `Claude`, one with `agent:'codex'` is labelled `Codex` whatever the current agent
  - Green: constants that embed the name become functions of the name
  - Verify: `pnpm --filter @nautink/web test`
  - Acceptance: no hard-coded "Claude" left in `apps/web/src/chat/` outside comments and tests

- [x] **T6 — Review, edit, code, history, settings and first-run strings**
  - context - the rest of the 45 strings
  - Files: `review/review-bar.tsx`, `review-actions.ts`, `review-history-guard.ts`, `use-review.ts`, `edit/read-only-reason.ts`, `edit/canvas-views.ts`, `edit/selection-prompt/selection-prompt.tsx`, `shell/code-drawer.tsx`, `code/ask-claude-to-fix.ts`, `history/version-text.ts`, `workspace/undo-redo-controls.tsx`, `settings/codebase-setting.tsx`, `settings/repo-badge.tsx`, `first-run/first-run-screen.tsx`, tests
  - Red: with agent `codex`: `Codex proposes 3 changes`, `Ask Codex about these 2…`, `Codebase Codex can read`, read-only reason names Codex; a version with `agent:'codex'` shows `Codex` in history
  - Green: same helper as T5. The undo menu's source label for agent steps becomes `Agent` (it was `Claude`): an edit entry does not know its agent, and the step label already names it (`Codex: …`)
  - Verify: `pnpm --filter @nautink/web test`
  - Acceptance: `grep -rn "'[^']*Claude" apps/web/src --include=*.tsx --include=*.ts` finds only tests, comments and the agent label table

- [x] **T7 — E2E: chat with Codex**
  - context - Playwright stubs `/api/chat` with canned SSE (`e2e/chat.spec.ts`)
  - Files: `apps/web/e2e/agent.spec.ts` (new), `apps/web/e2e/helpers.ts`
  - Red: pick Codex in Settings, send a prompt; stub asserts body `agent: 'codex'`; reply bubble labelled `Codex`; review bar says `Codex proposes …`; after reload Codex is still selected
  - Green: fix whatever the spec finds
  - Verify: `pnpm --filter @nautink/web exec playwright test e2e/agent.spec.ts`
  - Acceptance: spec green; existing e2e suite green

- [x] **T8 — Changesets and README**
  - context - user-facing feature
  - Files: `.changeset/web-codex-agent.md`, `README.md` (features: choose Claude or Codex)
  - Red: n/a — `pnpm format:check`
  - Green: changeset for `@nautink/web` and `@nautink/storage`; README line
  - Verify: `pnpm format:check && pnpm check`
  - Acceptance: gate green

## Definition of done

The items in [`docs/plans/README.md`](README.md), plus this plan's acceptance criteria.

## Open questions

Resolved with the user: agent picker in Settings only.

1. README screenshots keep showing Claude. Retake later, or not needed?
