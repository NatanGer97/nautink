---
description: File a GitHub issue, or adopt an issue-less plan into a tracked one
argument-hint: [description | plan-path]
---

Argument: **$ARGUMENTS**

Follow `docs/agents/skills/issue-writer.md` and follow it exactly. Dispatch on the argument:

- A path under `docs/plans/` → **adopt**: file the issue from that plan, rename the file to
  `<n>-<slug>.md`, post the orchestrator comment seeded from the plan's current checkbox state, update the
  frontmatter.
- Anything else, or nothing → **create**: draft an issue from the argument, or from this conversation when
  there is no argument.

Show the draft and wait for confirmation before `gh issue create`. Report the new issue number.
