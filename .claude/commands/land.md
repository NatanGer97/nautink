---
description: Run the gates, commit, push, and open a pull request for the finished work
---

Land the current work.

Use the `lander` skill and follow it exactly: `pnpm check` and `pnpm format:check`, branch guard
(never `main`), a Conventional Commits message in English referencing the issue, then push and open the
pull request with the plan link and `Closes #<issue#>`.

Ask before pushing and again before creating the pull request. Stop at the first red gate.
