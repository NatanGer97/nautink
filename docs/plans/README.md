# Plans

Plan files live flat in this directory: `<issue#>-<slug>.md` when tracked by a GitHub issue,
`<slug>.md` when not (`issue: none` in the frontmatter). See [`docs/agents/sdlc.md`](../agents/sdlc.md)
for how they get here and how they're worked.

## Definition of done

Every plan's tasks must clear these, on top of the plan's own acceptance criteria:

1. `npm run check` green (lint, typecheck, test, build).
2. `npm run format:check` clean.
3. The task's acceptance criteria met, and covered by the tests it names.
4. A changeset (`pnpm changeset`) when the work changes source under `apps/` or `packages/`.

Add project-specific items here as they come up (e.g. a domain invariant, a security rule, a
performance budget) — `work-reviewer` and `plan-executor` read this file, not a copy of it.
