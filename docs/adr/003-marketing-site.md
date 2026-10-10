# ADR-003: A marketing page in the repo
- **Status:** Accepted
- **Date:** 2026-10-10

## Context
The PRD listed a marketing site as a non-goal for v2.0 and left it for later (§1, §6.8). The app is now
far enough along that it needs one page that explains what Nautink does and how to start, outside the
README. Three questions were open: where the page lives, what it is built with, and whether it is part
of the app's releases.

Every workspace is in one Changesets `fixed` group, so any changeset bumps the whole app's version, and
`scripts/tag-release.ts` fails when workspace versions differ.

## Decision
- **One static page in `apps/site` (`@nautink/site`).** Plain HTML and CSS with a few small TypeScript
  modules, built with Vite. No framework and no effect libraries: React Bits and the like stay out
  (§6.8), and the page has nothing to run that needs them.
- **One copy of every image.** The page uses the README screenshots in `docs/screenshots/` and the logo
  in `docs/brand/` directly. Geist is self-hosted from the `geist` package, like the app, so the page
  loads nothing from a third-party server.
- **Hosted on GitHub Pages.** `.github/workflows/site.yml` builds the page and deploys it to
  https://natanger97.github.io/nautink/ on every push to `main` that touches it (or its images in
  `docs/`), and on demand. `vite build` writes relative URLs, so the same `dist/` also works at a
  domain root if the page moves to its own domain later. Pages needs the repository to be public,
  which the page assumes anyway: its GitHub links and clone command point at the repository.
- **Not part of the released app.** `@nautink/site` is in `ignore` in `.changeset/config.json`, so
  Changesets never versions it and it never appears in release notes. `scripts/tag-release.ts` leaves
  ignored workspaces out of the shared-version check, and `scripts/check-changeset.ts` needs no
  changeset for a change under `apps/site/`.
- **The page follows the app.** Its claims (features, numbers, agents) must match the code on `main`.
  A change that makes a claim untrue updates the page in the same pull request.

## Consequences
- A site change ships without a version bump or a changelog line; its history is git.
- A second workspace outside the app would need the same two entries: `ignore` in the Changesets config
  and a prefix in `scripts/check-changeset.ts`.
- Updating a README screenshot updates the page too.
- The page's copy can drift from the app. Reviewers check it when a feature, a number or an agent
  changes.
