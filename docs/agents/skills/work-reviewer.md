# Reviewing work

A pre-landing gate. Read the diff, check it against what follows, report findings. The pipeline this
belongs to is described in `docs/agents/sdlc.md`.

## Get the diff

```bash
git diff $(git merge-base HEAD <base>)...HEAD
```

`<base>` defaults to `main`. Read the changed files themselves when the diff alone doesn't settle a
question — a hunk out of context hides as much as it shows.

Find the plan. A tracked branch carries the issue number — `feat/42-empty-space-fallback` →
`docs/plans/42-*.md`. An untracked branch carries only the slug — `feat/empty-space-fallback` →
`docs/plans/empty-space-fallback.md`, whose frontmatter says `issue: none`. If neither resolves, ask
which plan this branch implements rather than reviewing against nothing.

## Check, in this order

### 1. The plan's acceptance criteria

Each task's `Acceptance` line, one at a time. Met, or not met and why. A task ticked in the plan whose
acceptance isn't actually met is a finding.

### 2. Definition of done

The items in `docs/plans/README.md` — currently: `pnpm check` green, `pnpm format:check` clean,
and each task's acceptance criteria covered by the tests it names.

### 3. Project-specific gates the linter can't see

Fill this section in per project (a domain invariant, a security rule, an accessibility requirement).
Until then, skip it — there's nothing to check.

## Report

One line per finding, nothing else:

```
path:line: <severity>: <problem>. <fix>.
```

Severity is `blocker`, `major`, or `minor`. Order by severity.

No praise, no summary of what the code does, no scope creep into work the plan didn't ask for. Skip
formatting nits — Prettier owns those. If nothing is wrong, say so in one line.
