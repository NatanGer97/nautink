issue: 2
orchestrator_comment: https://github.com/NatanGer97/nautink/issues/2#issuecomment-6099749015

# Start Nautink with one command (`npx nautink`)

## Context

Trying Nautink takes a clone, Node 22, pnpm, `pnpm install` and `pnpm dev`. Every workspace package is
`private` at `0.0.0`, so nothing can be installed from npm.

Facts that shape the plan:

- The server runs `src/*.ts` directly through Node's type stripping. Node refuses to strip types from
  files under `node_modules`, so an installed package must ship compiled JavaScript. That is build
  output in `dist/` (already ignored by ESLint); ADR-001's "TypeScript only" rule covers source and
  still holds.
- The server finds the web app through `REPO_ROOT/apps/web/dist` (`apps/server/src/server.ts`,
  `findWebDist`), which does not exist inside an installed package.
- `@nautink/contracts` exports `.ts` source, so the server cannot depend on it at runtime from npm
  either; workspace code must be bundled in.
- The root `package.json` is already named `nautink` (private). Two workspace projects cannot share
  a name.
- The web app calls `/api` on its own origin, so one server serving both works with no change.
- The server package holds 100% line coverage (`apps/server/vitest.config.ts`).

Release decisions already made (they belong to #4, listed here so this plan does not contradict
them): first public version `0.1.0` as a preview; npm publishing through trusted publishing from CI.

## Target

A new `nautink` package (`apps/cli`) that, once packed and installed, starts the local server with the
built web app and opens it in the browser from one command.

## Out of scope

- Publishing to npm, the changesets config change, `release.yml` and trusted publishing: #4.
- The hosted demo: #3.
- A desktop app, Homebrew formula or Windows installer.
- Codex as a provider: #5 (the CLI must not block it; it passes the env through).

## Tasks

- [x] **T1 — Let `startServer` take the web app folder**
  - context - the CLI must point the server at its own copy of the web app, in production mode,
    whatever `NODE_ENV` says.
  - Files: `apps/server/src/server.ts`, `apps/server/src/server.test.ts`
  - Red: test that `startServer({ ..., webDistDir: <temp dir with index.html> })` serves that
    `index.html` on `GET /` with `NODE_ENV` unset; fails because the option does not exist.
  - Green: add optional `webDistDir` to `StartOptions`; when given, it wins over `findWebDist`. A
    given folder without `index.html` throws an explicit error. `startServer` returns the bound
    port (or keep returning `Server` and document reading it) so the CLI can print the URL.
  - Verify: `pnpm --filter @nautink/server test`
  - Acceptance: server serves a folder passed in code; existing env behaviour unchanged; coverage
    stays at 100%.

- [x] **T2 — Free the `nautink` name and scaffold `apps/cli`**
  - context - root package is named `nautink`; the publishable package needs that name.
  - Files: `package.json` (rename root to `nautink-monorepo`), `apps/cli/package.json`,
    `apps/cli/tsconfig.json`, `apps/cli/vitest.config.ts`, `apps/cli/src/args.ts`,
    `apps/cli/src/args.test.ts`, `pnpm-lock.yaml`
  - Red: `args.test.ts` for `parseCliArgs`: defaults (`port: null`, so the server keeps reading
    `API_PORT` or 8791; `shouldOpen: true`),
    `--port 9000`, `--no-open`, `--help`, `--version`; unknown flag and bad port throw with a clear
    message. Fails because `args.ts` does not exist.
  - Green: `parseCliArgs(argv)` on `node:util` `parseArgs` tokens, every unknown token refused.
    `--port` wins over `API_PORT` by being passed to the server as `API_PORT`. Package `nautink`, `"bin": { "nautink": "dist/cli.js" }`, `"files": ["dist"]`, still
    `private: true` until #4.
  - Verify: `pnpm --filter nautink test`, `pnpm install` succeeds
  - Acceptance: both workspace names unique; flag parsing covered, invalid input throws.

- [x] **T3 — Open the browser**
  - context - the command should land the user in the app, but never fail because no browser exists
    (SSH, CI, containers).
  - Files: `apps/cli/src/open-browser.ts`, `apps/cli/src/open-browser.test.ts`
  - Red: tests that the command is `open` on darwin, `xdg-open` on linux, `cmd /c start ""` on
    win32, and that a spawn failure returns a "open this URL yourself" message instead of throwing.
    Fails: module missing.
  - Green: `openBrowser(url, platform, spawn)` with injected `spawn`; detached, ignored stdio.
  - Verify: `pnpm --filter nautink test`
  - Acceptance: per-platform command covered; failure path covered.

- [x] **T4 — The `nautink` command**
  - context - wires args, server and browser together.
  - Files: `apps/cli/src/cli.ts`, `apps/cli/src/run.ts`, `apps/cli/src/run.test.ts`
  - Red: `run(argv, deps)` tests with injected `startServer` and `openBrowser`: starts the server on
    the parsed port with `webDistDir` next to the built file, prints
    `Nautink is running at http://127.0.0.1:<port>`, opens the browser unless `--no-open`, prints
    help/version and exits 0 without starting, exits 1 with the error text on bad args or a taken
    port. Fails: module missing.
  - Green: `run.ts` holds the logic; `cli.ts` is a thin entry (shebang, `process.argv`), excluded from
    coverage like `apps/server/src/main.ts`. Env (`CLAUDE_BIN`, `REPO_DIR`) passes through unchanged.
  - Verify: `pnpm --filter nautink test`
  - Acceptance: every branch covered; no silent defaults on bad input.

- [x] **T5 — Build the package**
  - context - the installed package needs compiled JS with workspace code bundled in, plus the web
    app.
  - Files: `apps/cli/scripts/build.ts`, `apps/cli/tests/build.test.ts`, `apps/cli/package.json`,
    `apps/cli/turbo.json`, root `package.json` (dev dependency for the bundler)
  - Red: `build.test.ts` runs the build and asserts `dist/cli.js` exists, starts with
    `#!/usr/bin/env node`, contains no `@nautink/` import, and `dist/web/index.html` exists;
    `node dist/cli.js --version` prints the package version. Fails: no build script.
  - Green: bundle `src/cli.ts` with esbuild (platform node, ESM, target node22), workspace packages
    bundled, npm dependencies (`express`, `zod`) left external and listed in `dependencies`. Copy
    `apps/web/dist` to `dist/web`. Turbo `build` depends on `@nautink/web#build`.
  - Verify: `pnpm --filter nautink build && pnpm --filter nautink test`
  - Acceptance: `pnpm build` produces a runnable `apps/cli/dist`.

- [x] **T6 — Smoke test the packed tarball**
  - context - proves the real install path: `node_modules`, no workspace, no TypeScript.
  - Files: `apps/cli/tests/pack.test.ts` (or `scripts/check-pack.ts` plus a CI step in
    `.github/workflows/ci.yml`)
  - Red: pack with `pnpm pack`, install the tarball into a temp folder with `npm install`, run
    `nautink --no-open --port 0` (or a free port), expect `GET /` to return the app's `index.html`
    and `GET /api/info` a valid response; fails until T5's output is complete (for example a missing
    runtime dependency).
  - Green: fix whatever the install path exposes (missing `files`, deps, paths).
  - Verify: the smoke test, then `pnpm check`
  - Acceptance: a clean install from the tarball serves the app and the API.

- [x] **T7 — Docs and changeset**
  - context - users must find the one command first.
  - Files: `README.md` (Quick start leads with `npx nautink`, notes it works after the first
    release), `CONTRIBUTING.md` (clone-and-`pnpm dev` path), `apps/cli/README.md` (flags and env),
    `.changeset/cli-npx.md`
  - Red: none (docs). `pnpm lint:changeset` fails without the changeset.
  - Green: write the docs and a `minor` changeset for `nautink`.
  - Verify: `pnpm format:check`, `pnpm check`
  - Acceptance: README shows `npx nautink` first; flags documented.

## Definition of done

The items in [`docs/plans/README.md`](README.md), plus this plan's acceptance criteria.

## Open questions

Resolved 2026-10-10 with the plan's defaults: esbuild as the bundler; a taken port fails with the
existing clear message; the tarball smoke test is its own CI step; Windows is covered by testing the
command choice only.

Still open: none.
