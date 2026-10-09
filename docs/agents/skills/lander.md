# Landing work

The last step of the pipeline in `docs/agents/sdlc.md`. Gates first, then branch, then commit, then push,
then pull request. Stop at the first failure.

## 1. Gates

```bash
pnpm check
pnpm format:check
```

`pnpm check` runs lint, typecheck, test, and build. A red gate ends the run — report it and stop.
Don't push work that doesn't pass.

If `format:check` fails, run `pnpm format` and include the result in the commit.

## 2. Branch guard

Never commit on `main`. Check first:

```bash
git rev-parse --abbrev-ref HEAD
```

On `main`, create a branch before staging anything:

- tracked plan → `<type>/<issue#>-<slug>`, e.g. `feat/42-empty-space-fallback`
- untracked plan (`issue: none`) → `<type>/<slug>`, e.g. `feat/empty-space-fallback`

## 3. Commit

Conventional Commits, in English:

```
<type>(<scope>): <subject>

<body: what changed and why, wrapped at 72>

Refs #<issue#>
```

Types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `ci`. Scope is the package or area the change
touches.

On an untracked plan, drop the `Refs` trailer — there is no issue to reference.

End the message with the attribution trailer the session's instructions give, when one is given.

Review `git status` and `git diff --staged` before committing. Never stage files the work didn't touch.
Never add `.env`, coverage output, or build artifacts.

## 4. Push and open the pull request

**Ask the user before pushing, and again before creating the pull request.** Both are outward-facing.

```bash
git push -u origin <branch>
gh pr create --title "<same subject as the commit>" --body "$(cat <<'BODY'
## What

<one paragraph>

## Plan

`docs/plans/<issue#>-<slug>.md`

Closes #<issue#>
BODY
)"
```

On an untracked plan, drop the `Closes #<issue#>` line — the plan link is the only pointer. Untracked work
still lands normally; if the user wants it tracked first, `/new-issue docs/plans/<slug>.md` adopts the
plan and then `Closes` applies.

Always a pull request, including for docs-only changes. Never push straight to `main`.

End the pull request body with the attribution footer the session's instructions give, when one is
given.

## 5. Report

The pull request URL, and anything you chose not to include and why.
