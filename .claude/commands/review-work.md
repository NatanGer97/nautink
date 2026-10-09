---
description: Review the branch against its plan, the Definition of done, and the repo gates
argument-hint: [base]
---

Review this branch's work. Base for the diff: **$1** (default `main`).

Use the `work-reviewer` skill and follow it exactly: diff against the merge base, then check the plan's
acceptance criteria, the Definition-of-done items in `docs/plans/README.md`, and any repo gates no linter
covers.

Report one line per finding — `path:line: <severity>: <problem>. <fix>.` — ordered by severity. Nothing
else. Do not fix anything; this command only reports.
