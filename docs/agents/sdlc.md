# Agentic SDLC

How work moves from an idea — tracked by a GitHub issue or not — to a merged pull request in this repo.

Five commands. Each one is a thin entry point; the procedure lives in `docs/agents/skills/`, harness-neutral,
and every harness reads that same file:

| Command                                      | Procedure                                | Produces                                                    |
| -------------------------------------------- | ---------------------------------------- | ----------------------------------------------------------- |
| `/new-issue [description \| plan-path]`      | `docs/agents/skills/issue-writer.md`     | A filed issue — new, or adopted from an untracked plan      |
| `/write-plan [issue#]`                       | `docs/agents/skills/plan-writer.md`      | A plan file in `docs/plans/`, and a task table when tracked  |
| `/execute-plan <issue#\|path> [--delegated]` | `docs/agents/skills/plan-executor.md`    | Code, task by task, with the trackers kept current           |
| `/review-work [base]`                        | `docs/agents/skills/work-reviewer.md`    | A list of findings against the plan and the gates            |
| `/land`                                      | `docs/agents/skills/lander.md`           | A commit, a pushed branch, and a pull request                |

Self-contained, no external plugin dependency. They live in this repo, so they change with the repo.

## Harnesses

| Harness      | Entry points                     | Per-file lint                                    |
| ------------ | -------------------------------- | ------------------------------------------------ |
| Claude Code  | `.claude/commands/` + `.claude/skills/` stubs | `PostToolUse` hook in `.claude/settings.json` |
| Codex CLI    | `.codex/prompts/`, installed with `pnpm agents:install-prompts` | `pnpm lint:file <path>`, per `AGENTS.md` |
| Anything else | `AGENTS.md` and the procedure files | `pnpm lint:file <path>` |

The commands are canonical and the Codex prompts are generated from them (`pnpm agents:sync`);
`pnpm check:agents` fails when they drift, when a procedure has no stub, or when `CLAUDE.md` stops
being the `AGENTS.md` symlink.

## The pipeline

### 0. Tracked or untracked

Most work is **tracked**: a GitHub issue exists, and its number ties the plan, the branch, and the pull
request together. `/write-plan 42` takes that path.

Some work isn't worth a ticket. `/write-plan` with no argument asks which you want: file an issue first
(it hands off to `/new-issue`), plan **untracked**, or supply an existing number. A number that doesn't
resolve gets the same offer — it never plans against a phantom issue.

An untracked plan is `docs/plans/<slug>.md` with `issue: none` in its frontmatter. No orchestrator
comment; its checkboxes are the only tracker. It executes, reviews, and lands like any other plan — the
pull request simply has no `Closes` line.

Untracked isn't a dead end. `/new-issue docs/plans/<slug>.md` **adopts** the plan at any point: files the
issue, renames the file to `<n>-<slug>.md`, and posts the orchestrator seeded from the checkboxes as they
stand, so a half-executed plan keeps its progress.

### 1. Plan

`/write-plan 42` reads issue #42 (`gh issue view`, per [issue-tracker.md](issue-tracker.md)), then the
context the work touches.

Two rules shape the output:

- **One plan = one target.** Two targets means two issues and two plans. This is a hard stop: if the
  issue covers more than one target, the procedure refuses to write a plan and proposes the split.
- **Every task is a TDD block.** Write the failing test → verify it fails → write the code → verify it
  passes → verify nothing else broke. A task that cannot be written this way is too big or too vague.

The plan is always an artifact — a Markdown file in `docs/plans/`, flat alongside `README.md`. Never plan
only in chat.

On a tracked plan, the procedure also posts an **orchestrator** comment on the issue: a `## Tasks` table with
one row per task and a status of `pending`, `in-progress`, or `done`. The comment's id goes into the plan
file's frontmatter, so later runs update that comment instead of adding new ones. An untracked plan skips
this — there is nowhere to post it.

### 2. Execute

`/execute-plan 42` walks the tasks in order. Inline by default — one task at a time in the main thread,
so the run stays watchable. `--delegated` runs each task in its own agent instead, which saves context
but hides the work while it happens, and needs a harness that can spawn one.

Either way the reporting is the same. Before each task, one line:

```
▶ Task 3/7 adding failing test for empty-space fallback
```

Then the state of each step, in words:

```
red — fails as expected — "expected 0, got undefined"
green — 4/4 pass
verified — suite green, typecheck clean
✔ Task 3/7 done
```

Progress is tracked **in files, not just chat**: the checkbox in the plan file and the row in the
orchestrator comment both move as the task moves. A fresh session with no memory of the conversation can
resume from those two alone.

Two stop conditions:

- A task that fails twice stops the run and reports. Don't improvise around the plan.
- Plan changes are explicit edits to the plan file. Never silent drift.

### 3. Review

`/review-work` diffs against the merge base and checks two things, in order: the plan's own acceptance
criteria, and the Definition-of-done items in [`docs/plans/README.md`](../plans/README.md). Add a third
check — repo-specific gates no linter covers — once the project has any.

### 4. Land

`/land` runs the gates, guards the branch, writes the commit, pushes, and opens the pull request. It
asks before the push and before creating the pull request.

## Conventions these commands assume

- An issue is the usual unit of work, and `<issue#>` is the key that ties a plan, a branch, and a pull
  request together. Work without one is allowed, not second-class.
- Plan files are flat in `docs/plans/`: `<issue#>-<slug>.md` when tracked, `<slug>.md` when not. The
  `issue:` frontmatter is what the procedures read — never the filename.
- Work happens on a branch, never on `main`, and lands through a pull request.
- Filing an issue always needs an explicit confirmation first. The number is spent even if it's closed.
