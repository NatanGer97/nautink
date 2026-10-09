# Executing a plan

Walk the tasks in order. Keep both progress trackers current. Stop when told to. The pipeline this
belongs to is described in `docs/agents/sdlc.md`.

## Resolve the plan

Argument is an issue number or a path. From an issue number, the plan is `docs/plans/<issue#>-*.md`.
Read it in full before starting, including the frontmatter.

The frontmatter says which kind of plan this is:

- `issue: <n>` — **tracked**. `orchestrator_comment` is the comment to keep updated.
- `issue: none` — **untracked**. There is no comment. The checkboxes are the only tracker.

Resuming is the normal case, not the exception: the first unticked checkbox is the next task. Never
re-run a task already marked done.

## Mode

Inline by default: one task at a time in the main thread. Short, watchable, no long silent stretch.

`--delegated` runs each task in its own agent, given the task's section of the plan and the repo
conventions it needs. Relay the same reporting lines when it returns. Same stop conditions apply — a
delegated run that reports a second failure ends the whole run. Whether a separate agent is available,
and how it is spawned, is a property of the harness, not of this procedure; when it isn't available, run
inline and say so.

## The loop, per task

Announce first. One short line, no preamble:

```
▶ Task 3/7 adding failing test for empty-space fallback
```

Then the TDD block, reporting each state in words:

1. Write the failing test. Run it.
   `red — fails as expected — "expected 0, got undefined"`
2. Write the code. Run the test again.
   `green — 4/4 pass`
3. Check nothing else broke — `pnpm check`, or the narrower command the plan names.
   `verified — suite green, typecheck clean`
4. `✔ Task 3/7 done`

If the test passes on the first run, it isn't testing the change. Say so, fix the test, and stay in the
red step.

## Track progress in files, not just chat

After each task, tick the checkbox in the plan file: `- [ ] **T3` → `- [x] **T3`.

On a **tracked** plan, also flip the row in the orchestrator comment, using the id in the plan
frontmatter — both, not one:

```bash
gh api --method PATCH repos/{owner}/{repo}/issues/comments/<comment-id> -f body="$(cat <<'BODY'
...updated table...
BODY
)"
```

Mark a row `in-progress` when the task starts and `done` when it finishes. A fresh session with no
conversation history must be able to resume from the plan file and that comment alone.

On an **untracked** plan (`issue: none`), skip the `gh api` call — there is nothing to PATCH. Don't file
an issue to have something to update; `/new-issue docs/plans/<slug>.md` adopts the plan when the user
wants it tracked, and it seeds the comment from the checkbox state you left behind.

## Stop conditions

- **A task that fails twice stops the run.** Report what failed, quote the shortest decisive line of the
  error, leave the checkbox unticked and — on a tracked plan — the row `in-progress`. Do not try a third
  approach.
- **Do not improvise around the plan.** Work not in a task is not in scope.
- **Plan changes are explicit edits to the plan file.** If a task turns out wrong, edit the plan, say
  what changed, then continue. Never silent drift.

## Project-specific gates

Add here any rule that applies to every task and that the linter can't check (a domain invariant, a
security rule, a required test pattern). `docs/plans/README.md` is the other place these get listed —
keep them in sync.
