# Repository rulesets

The GitHub rulesets for this repository, kept as code. GitHub does not read these files: they are the
source of truth that `pnpm rulesets:apply` pushes to the repository settings. Change a rule here first,
then apply it.

| File | Protects | Rules |
|---|---|---|
| `main.json` | the default branch | no deletion, no force push, linear history, changes only through a squash-merged pull request with resolved threads, `check` and `e2e` green on an up-to-date branch |
| `release-tags.json` | `v*` tags | no deletion, no move: a released version stays where `scripts/tag-release.ts` put it |

Admins can bypass `main.json` only through a pull request, never with a direct push. That bypass is
what merges the "Version Packages" pull request: the Release workflow opens it with `GITHUB_TOKEN`,
and GitHub does not run CI for events that token creates, so its required checks never report.

No approving review is required because the project has one maintainer, and GitHub does not let an
author approve their own pull request.
