---
description: Run a plan task by task, TDD-style, ticking the plan file and the issue task table
argument-hint: <issue#|plan-path> [--delegated]
---

Execute the plan identified by **$ARGUMENTS**.

Follow `docs/agents/skills/plan-executor.md` and follow it exactly.

- The first argument is an issue number (plan is `docs/plans/<issue#>-*.md`) or a path to a plan file.
- `--delegated` runs each task in its own agent. Without it, run inline, one task at a time.

Resume from the first unticked checkbox. Report `▶` / `red` / `green` / `verified` / `✔` as the skill
specifies, tick the plan checkbox and update the orchestrator comment after each task, and stop if a task
fails twice.
