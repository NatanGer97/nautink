# AGENTS.md — Merrow

Merrow (working name, may change) is a local-first, open-source web app for building Mermaid diagrams:
a canvas you edit by hand or by chatting with a coding agent, with every agent change shown as an
accept/reject review. It is a rebuild of `~/dev/mermaid-chat` in TypeScript.

Always use simple, clear language that is easy to understand.

This file is the contract for every agent harness. `CLAUDE.md` is a symlink to it, so Claude Code,
Codex CLI, and anything else that reads `AGENTS.md` get one copy with no drift.

## Plan mode conventions

When writing plans, be extremely concise. Sacrifice grammar for the sake of concision.
At the end of each plan, list unresolved questions. Ask about edge cases, error handling, and unclear
requirements before proceeding. End every plan with a numbered list of concrete steps. This should be
the last thing visible in the terminal.

Two rules shape every plan, whether it comes from plan mode or from `/write-plan`:

- **One plan = one target.** Two targets means two plans. If the work covers more than one target, say
  so and propose the split instead of planning both.
- **Every task is a TDD block:** write the failing test → verify it fails → write the code → verify it
  passes → verify no regressions. A task that can't be written that way is too big or too vague.

Plans are artifacts, not chat: `/write-plan` writes them to `docs/plans/`, with or without a tracking
issue. See `docs/agents/sdlc.md`.

## Working agreements

- **The repo is the source of truth.** PRD, ADRs and plans live in `docs/`. If a decision is not in
  `docs/`, it is not decided.
- **Language:** all docs, code, identifiers and commit messages are in English.
- **Never change an accepted ADR.** Supersede it with a new ADR (`docs/adr/000-template.md`).
- **Invalid input throws an explicit error.** Never return a silent default.
- **Monorepo:** pnpm workspaces + Turborepo. Apps in `apps/*`, shared libraries in `packages/*`.
  A change to source there needs a changeset (`pnpm changeset`).

## Where things are

| Path | What |
|---|---|
| `docs/agents/` | The SDLC pipeline (`sdlc.md`), its procedures (`skills/`), issue tracker, triage labels, domain docs |
| `docs/adr/` | Architecture decisions (numbered, immutable once accepted) |
| `docs/plans/` | One plan file per piece of work, plus the Definition of done |
| `docs/conventions.md` | Coding conventions and the ESLint/Prettier rules that enforce them |
| `CONTEXT.md` | Glossary of domain terms, created lazily (see `docs/agents/domain.md`) |

## Gates

```bash
pnpm check              # lint, typecheck, test, build — the gate that must be green before landing
pnpm format:check       # Prettier
pnpm lint:file <path>   # format + lint one file, exits 2 with the report when it is not clean
```

**After writing or editing any `.ts`, `.tsx`, `.mts`, or `.cts` file,
run `pnpm lint:file <path>` and fix what it reports before moving on.** Claude Code does this
automatically through the `PostToolUse` hook in `.claude/settings.json`; every other harness must run
the command. The husky hooks and CI enforce the same rules at commit and push time, so skipping the
per-file step only moves the failure later.

Conventions the linter cannot express, and the review-only rules, are in
[`docs/conventions.md`](docs/conventions.md).

## The SDLC pipeline

Five procedures, one per stage, described in [`docs/agents/sdlc.md`](docs/agents/sdlc.md). The procedure
text lives in `docs/agents/skills/` and is the single source of truth; the harness wrappers only point
at it.

| Ask                                     | Procedure to read and follow           | Claude Code | Codex CLI      |
| --------------------------------------- | -------------------------------------- | ----------- | -------------- |
| File an issue, adopt an untracked plan  | `docs/agents/skills/issue-writer.md`   | `/new-issue` | `/new-issue`   |
| Plan an issue, break work into tasks    | `docs/agents/skills/plan-writer.md`    | `/write-plan` | `/write-plan` |
| Run a plan task by task                 | `docs/agents/skills/plan-executor.md`  | `/execute-plan` | `/execute-plan` |
| Review a branch before landing          | `docs/agents/skills/work-reviewer.md`  | `/review-work` | `/review-work` |
| Commit, push, open the pull request     | `docs/agents/skills/lander.md`         | `/land`      | `/land`        |

When the user asks for one of these without a slash command, read the matching file and follow it
exactly. Read the whole file before acting on any part of it.

Codex CLI discovers custom prompts in `~/.codex/prompts` only, so the repo's copies in `.codex/prompts/`
are installed with:

```bash
pnpm agents:install-prompts
```

## Outward-facing actions

`gh issue create`, `git push`, and `gh pr create` are outward-facing: show what you are about to do and
wait for confirmation. This holds in every harness, whatever its permission settings allow.
