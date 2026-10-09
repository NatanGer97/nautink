# Merrow

> Working name — may change.

A local-first, open-source web app for building [Mermaid](https://mermaid.js.org) diagrams: one canvas
you edit by hand or by chatting with a coding agent, with every agent change shown as an
accept/reject review. A TypeScript rebuild of `mermaid-chat`.

Status: harness only. No app code yet.

## Requirements

- Node 22 (see `.nvmrc`; pnpm pins the exact version through `.npmrc`)
- pnpm 9 (`packageManager` in `package.json`)

## Getting started

```bash
pnpm install
pnpm check
```

`pnpm install` also wires up the husky git hooks.

## Repo layout

| Path | What |
|---|---|
| `apps/*` | Runnable apps |
| `packages/*` | Shared libraries |
| `docs/` | ADRs, plans, conventions, and the agent SDLC docs |
| `scripts/` | The gate scripts, and the checks that prove each gate still fires |
| `tools/` | The local ESLint plugin and its lint fixtures |

## Gates

| When | What runs |
|---|---|
| An agent writes a file | `pnpm lint:file <path>` (the Claude Code `PostToolUse` hook runs it automatically) |
| `git commit` | lint-staged: Prettier + ESLint on staged files |
| `git push` | `lint`, `lint:fixtures`, `check:agents`, `test:changeset-gate`, `test:coverage-gate` |
| Pull request / push to `main` | The full `turbo` graph, every gate assertion, the changeset check, `format:check` |

Every gate that could be weakened silently has a script that proves it still fires. See
[`docs/conventions.md`](docs/conventions.md).

## Working with agents

`AGENTS.md` is the contract for every agent harness; `CLAUDE.md` is a symlink to it. The SDLC pipeline
(`/new-issue` → `/write-plan` → `/execute-plan` → `/review-work` → `/land`) is described in
[`docs/agents/sdlc.md`](docs/agents/sdlc.md). For Codex CLI, run `pnpm agents:install-prompts` once.

## Releases

Each change to `apps/` or `packages/` carries a changeset (`pnpm changeset`). On `main`, the release
workflow collects them into a "Version Packages" pull request; merging it bumps versions and tags a
GitHub Release. Nothing is published to a registry yet.

## License

Not chosen yet.
