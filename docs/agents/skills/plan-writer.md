# Writing a plan

One target in, one plan file out — plus an orchestrator comment when the work is tracked by an issue. The
pipeline this belongs to is described in `docs/agents/sdlc.md`.

## 1. Establish the target: tracked or untracked

A plan is **tracked** (it has a GitHub issue) or **untracked** (`issue: none`). Decide this first;
everything downstream reads it.

**Given a number**, check it exists before trusting it:

```bash
gh issue view <n> --json number
```

A non-zero exit means no such issue. Say so, offer the two ways forward — `/new-issue` to file one, or an
untracked plan — and write nothing until the user picks.

**Given a number that exists**, read it properly:

```bash
gh issue view <n> --comments --json number,title,body,labels
```

Comments matter — decisions often land there rather than in the body.

If the issue lacks the `ready-for-agent` label, **warn once and continue**. Don't refuse, and don't add
the label yourself.

**Given no argument**, ask which of three: file an issue now, plan untracked, or supply an existing
number. Don't guess, and don't silently skip the tracker.

When the user chooses to file one, follow `docs/agents/skills/issue-writer.md`, then continue with the
number it returns — from here the tracked path is identical.

## 2. Read the context

`README.md`, `AGENTS.md`/`CLAUDE.md`, and the code the work touches. Use whatever vocabulary the
codebase already uses in task names and test names — if the project has a glossary, follow it; don't
invent a synonym.

## 3. Check the one-target rule

**One plan = one target. Two targets = two plans.**

This is a hard stop. If the work covers more than one target — two features, or a feature plus an
unrelated refactor — do not write a plan. Say which targets you found, propose the split into separate
issues, and stop there.

A target is one coherent change with one acceptance story. "Add the export endpoint and its tests" is
one target. "Add the export endpoint, and also switch the date library" is two.

## 4. Decompose into tasks

Bite-sized: each task is one TDD block a reader can hold in their head.

```
write the failing test → verify it fails → write the code → verify it passes → verify no regressions
```

A task that can't be written that way is too big — split it — or too vague — resolve it in Open
questions first.

Order tasks so each one leaves the tree green. Name the narrowest verification command per task
(`pnpm test`, `pnpm typecheck`); reserve `pnpm check` for the regression step.

## 5. Write the plan file

Flat in `docs/plans/`, alongside `README.md`. The filename says which kind it is:

- tracked → `docs/plans/<issue#>-<slug>.md`
- untracked → `docs/plans/<slug>.md`

````markdown
issue: 42 # or: none
orchestrator_comment: <url from step 6 — omit entirely when untracked>

# <Title>

## Context

Why this work exists. The problem, and the intended outcome.

## Target

One sentence. One target.

## Out of scope

What this plan deliberately does not do.

## Tasks

- [ ] **T1 — <name>**
  - context - `[very short context on the task]`
  - Files: `src/foo.ts`, `src/foo.test.ts`
  - Red: `<the test that must fail first, and the failure you expect>`
  - Green: `<what the code must do>`
  - Verify: `pnpm test`
  - Acceptance: `<observable outcome>`

## Definition of done

The items in [`docs/plans/README.md`](README.md), plus this plan's acceptance criteria.

## Open questions
````

Link the Definition of done — don't copy its items into the plan, they'd go stale.

On an untracked plan, add one line under Context: _Untracked — no issue. Progress lives in this file's
checkboxes. `/new-issue docs/plans/<slug>.md` adopts it later._ That way a later reader doesn't hunt for
an issue that was never filed.

Keep the prose concise. Unresolved questions go at the end.

## 6. Post the orchestrator — tracked plans only

Skip this step entirely when `issue: none`. The checkboxes are the only tracker for an untracked plan.

```bash
gh issue comment <n> --body "$(cat <<'BODY'
## Tasks

| #   | Task   | Status  |
| --- | ------ | ------- |
| T1  | <name> | pending |
| T2  | <name> | pending |

Plan: `docs/plans/<issue#>-<slug>.md`
BODY
)"
```

`gh issue comment` prints the new comment's URL. Put it in the plan's `orchestrator_comment` frontmatter
so `/execute-plan` updates that comment rather than posting new ones.

## Never

- Never plan only in chat. The plan file is the artifact, tracked or not.
- Never write a plan for work with two targets.
- Never plan against an issue number that doesn't resolve.
- Never copy the Definition of done instead of linking it.
