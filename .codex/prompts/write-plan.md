---
description: Turn a GitHub issue — or an untracked description — into a plan file in docs/plans/
argument-hint: [issue#]
---

Write the implementation plan for **$1**.

Follow `docs/agents/skills/plan-writer.md` and follow it exactly. In short: read the issue and its comments, read the
context, enforce the one-target rule, decompose into TDD-shaped tasks, write the plan file, and post the
`## Tasks` orchestrator comment when the plan is tracked.

Three paths, per the skill:

- **A number that exists** → plan against that issue.
- **A number that doesn't exist** → say so, offer `/new-issue` or an issue-less plan. Write nothing yet.
- **No argument** → ask which: file an issue first, plan issue-less, or supply an existing number.

Do not start implementing. The plan file is the deliverable.
