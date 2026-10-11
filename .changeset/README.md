# Changesets

This folder holds the pending changesets: one Markdown file per change that is waiting for a release.

Each file names the workspaces a change touches, the bump each one takes (`patch`, `minor` or `major`),
and a one-line summary. That summary is the line a human later reads in the workspace's `CHANGELOG.md`,
so write it for that reader.

Add one with:

```bash
pnpm changeset
```

Every workspace in this repo is private. Changesets versions them and writes their changelogs; nothing
is published to a registry — see `.changeset/config.json`.

`pnpm changeset status` lists what is pending. Every workspace is in one `fixed` group, so they all
share one version: the app's version. That group includes `nautink`, the npm package, which is the
app as users install it. The marketing page (`@nautink/site`) is the exception: it is in
`ignore`, so it is never versioned and needs no changeset (ADR-003). On `main`, the release workflow turns the pending changesets into
a "Version Packages" pull request; merging that pull request is what bumps the versions. The run after
the merge pushes one tag for the whole app (`v0.1.0`) and creates one GitHub Release with every
workspace's changelog entries (`scripts/tag-release.ts`).

The full documentation lives in
[the Changesets repository](https://github.com/changesets/changesets/tree/main/docs).
