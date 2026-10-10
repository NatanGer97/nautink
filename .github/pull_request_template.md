## What and why

<!-- What this changes, and why. Link the issue or plan (Closes #123, docs/plans/...). -->

## How it was tested

<!-- Unit tests, e2e specs, manual steps. -->

## Screenshots

<!-- Required for any UI change: before and after, light and dark when colors change. -->

## Checklist

- [ ] The title is a [Conventional Commit](https://www.conventionalcommits.org) (`feat(web): …`, `fix(server): …`, `docs: …`)
- [ ] `pnpm check` and `pnpm format:check` are green
- [ ] A changeset is included (`pnpm changeset`) if source under `apps/` or `packages/` changed
- [ ] Screenshots are attached for UI changes
- [ ] `THIRD_PARTY_NOTICES.md` is regenerated if dependencies changed (`node scripts/generate-third-party-notices.ts`)
- [ ] No lint-disable comments were added
