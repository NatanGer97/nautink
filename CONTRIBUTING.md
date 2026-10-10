# Contributing to Nautink

Thanks for helping. This guide covers setup, the repo layout, the gates every change must pass, and
the few rules that are easy to miss. Please also read the [Code of Conduct](CODE_OF_CONDUCT.md).

## Setup

You need:

- **Node 22** (22.18 or newer). `.nvmrc` names the version, and `.npmrc` makes pnpm download and use
  that exact Node for every script, whatever is first on your `PATH`.
- **pnpm 9** (`packageManager` in `package.json`; `corepack enable` sets it up).
- **Claude Code CLI** (`claude` on your `PATH`, logged in) if you want to use the chat. Everything
  else works without it, and no test calls it.

```bash
pnpm install   # also installs the husky git hooks
pnpm check     # lint, typecheck, test, build: should be green on a fresh clone
```

## Running the app

```bash
pnpm dev
```

This starts both apps:

| App                                | Address                                  |
| ---------------------------------- | ---------------------------------------- |
| Web app (Vite)                     | http://localhost:5190                    |
| Local server (bridge to `claude`)  | http://127.0.0.1:8791 (localhost only)   |

Open http://localhost:5190. The web app reaches the server through Vite's `/api` proxy. Run one side
alone with `pnpm dev:web` or `pnpm dev:server`. The server's settings (`API_PORT`, `CLAUDE_BIN`,
`REPO_DIR`) are in [`apps/server/README.md`](apps/server/README.md).

## Repo layout

| Path                   | What                                                                         |
| ---------------------- | ---------------------------------------------------------------------------- |
| `apps/web`             | The React app: shell, panels, canvas, chat, code drawer, history, export     |
| `apps/server`          | The local Node bridge to the Claude Code CLI (Express, SSE)                  |
| `apps/cli`             | The published `nautink` package: one command that runs server and web app   |
| `packages/contracts`   | Zod schemas for the server API and its SSE events, shared by web and server  |
| `packages/editors`     | Pure model, edit operations and layout for the five visual editors           |
| `packages/visual-core` | The editor contract, diagram type detection, commit labels, positions        |
| `packages/storage`     | IndexedDB: diagrams, versions, positions, backup import and export           |
| `packages/ui`          | Design tokens, Geist fonts and the shadcn/ui components                      |
| `docs/`                | Product spec (`PRD.md`), ADRs, conventions, plans, agent SDLC docs           |
| `scripts/`             | Gate scripts, the checks that prove each gate still fires, notice generator  |
| `tools/`               | The local ESLint plugin and its lint fixtures                                |

Libraries have no build step: each package ships its TypeScript source and you import the file that
owns a symbol (`@nautink/contracts/chat`). Feature folders in `apps/web/src` have a `README.md` that
explains their seams; read it before changing that folder.

`apps/cli` is the one exception to "no build step": Node will not strip types inside
`node_modules`, so `pnpm --filter nautink build` bundles the command, the server and the workspace
packages into `apps/cli/dist/cli.js` and copies the built web app next to it. `pnpm check:pack` packs
that, installs it with npm into an empty folder and checks the installed `nautink` command serves the
app; CI runs it after `pnpm check`.

## The gates

| Command                    | What it does                                                               |
| -------------------------- | -------------------------------------------------------------------------- |
| `pnpm check`               | Lint, typecheck (tooling and every package), unit tests, build. Must be green |
| `pnpm format:check`        | Prettier (`pnpm format` fixes it)                                          |
| `pnpm lint:file <path>`    | Formats and lints one file; run it after editing any `.ts` or `.tsx` file  |
| `pnpm test:coverage-gate`  | Proves each gated package still fails when a file is not covered           |
| `pnpm lint:fixtures`       | Proves every custom lint rule still fires                                  |

Where they run:

| When                          | What runs                                                                 |
| ----------------------------- | ------------------------------------------------------------------------- |
| `git commit`                  | lint-staged: Prettier and ESLint on the staged files                      |
| `git push`                    | `lint`, `lint:fixtures`, `check:agents`, `test:changeset-gate`, `test:coverage-gate` |
| Pull request, push to `main`  | The full check graph, the gate assertions, the changeset check, `format:check` |

### Coverage

Each package sets its own Vitest coverage thresholds in its `vitest.config.ts`. Most libraries and
the server require 100% lines, functions and statements (95–100% branches); `apps/web` requires 70%
lines. A change that adds code adds the tests that cover it.

### Changesets

A change to source under `apps/` or `packages/` needs a changeset. Run `pnpm changeset`, pick the
packages and the bump, write one sentence about what changed for a user, and commit the file it
writes under `.changeset/`. Changes that are only docs, Markdown or repo configuration need none. CI
fails a pull request that changes package source without one.

### Commits

Commits and pull request titles follow [Conventional Commits](https://www.conventionalcommits.org):
`feat(web): …`, `fix(server): …`, `docs: …`, `test(editors): …`, `chore: …`. One logical change per
commit, written in the imperative ("add", not "added"), in English.

### Lint rules in short

The full list, and what is review-only, is in [`docs/conventions.md`](docs/conventions.md). The ones
people hit most:

- **TypeScript only.** No `.js`, `.jsx`, `.mjs` or `.cjs` files anywhere, configs and scripts
  included. Scripts run with `node script.ts` (Node strips the types), so use erasable syntax only:
  no `enum`, no `namespace`, no constructor parameter properties.
- Explicit types on variables, parameters and return values; never `any`; no `!` assertions.
- Functions under 20 lines (60 in `.tsx` components), complexity 10, nesting depth 3, at most 3
  parameters (use one options object beyond that), no blank lines inside a function body.
- Booleans are prefixed `is`, `has`, `can`, `should` (and similar); file names are kebab-case.
- `async`/`await` only, no `.then()` chains; no nested ternaries; no magic numbers.
- One primary export per file, named after the file; no barrel files; no default exports outside
  configs.
- Invalid input throws an error that names the bad value. Never return a silent default.
- **Never add lint-disable comments.** If a rule is wrong for a case, raise it in the pull request.

## End-to-end tests

Playwright drives the web app against its own Vite dev server. `/api/*` is mocked in each spec, so
the local server and Claude are not needed.

```bash
pnpm --filter @nautink/web exec playwright install chromium   # once
pnpm --filter @nautink/web test:e2e
```

`E2E_PORT` runs the suite on another port (for example from a second git worktree while 5190 is in
use), and `E2E_REUSE_SERVER=1` runs it against a dev server you started yourself.

The README screenshots come from a separate Playwright config that is not part of the normal run:

```bash
pnpm --filter @nautink/web exec playwright test --config e2e/screenshots/playwright.config.ts
```

It writes WebP files to `docs/screenshots/` (it uses port 5473 unless `E2E_PORT` is set).

## Adding or changing a visual editor

Each editor is one folder in `apps/web/src/edit/` plus one line in the editor registry, with its pure
model, operations and layout in `packages/editors`. Read
[`apps/web/src/edit/README.md`](apps/web/src/edit/README.md) for the contract, the shared canvas
chrome, and the rules (no imports from another editor's folder, undo and redo belong to the app).

## Golden fixtures

`packages/editors/tests/golden/*.json` record what v1 (the JavaScript app Nautink rebuilds) produced
for a fixed set of inputs, and the editor tests expect the TypeScript port to match them.

- Never edit these files by hand, and never change them to make a test pass. If the port and v1
  disagree, fix the port, or record the difference as an intentional deviation.
- How they were made, and how to regenerate them, is in
  [`packages/editors/tests/golden/README.md`](packages/editors/tests/golden/README.md).

## Third-party notices

`THIRD_PARTY_NOTICES.md` lists every production dependency of the two apps with its license. After
adding, removing or upgrading a dependency, regenerate it and commit the result:

```bash
node scripts/generate-third-party-notices.ts           # rewrite the file
pnpm check:licenses                                    # exit 1 when it is out of date or a license fails
```

`pnpm check:licenses` is part of `pnpm check`, so CI runs it too. It fails on any license that is not
on the script's permissive list, or that it cannot read. A new dependency under a copyleft (GPL, AGPL,
LGPL) or unknown license needs a discussion in the pull request first. If it is accepted, add it to
`REVIEWED` in the script with the license and the reason; the file's "Licenses to review" section
shows that reason. Also see PRD §6.8: effect libraries with non-permissive terms are not used in the
app.

The web build also writes `dist/third-party-licenses.txt`: Nautink's license, the attribution above,
and the full license text of every package the web app ships with. Settings links to it as
"Open-source licenses", so anyone running a build gets the notices the licenses ask for.

## Working with coding agents

[`AGENTS.md`](AGENTS.md) is the contract for every agent harness (`CLAUDE.md` is a symlink to it). It
points to the SDLC pipeline in [`docs/agents/sdlc.md`](docs/agents/sdlc.md): file an issue, write a
plan, execute it task by task, review, land. Agents must run `pnpm lint:file` after every edit;
Claude Code does it through the hook in `.claude/settings.json`. Pushing, opening issues and opening
pull requests always need a human's confirmation.

## Reporting bugs and security issues

Open an issue with the bug report template. For a security problem, do not open a public issue:
follow [`SECURITY.md`](SECURITY.md).
