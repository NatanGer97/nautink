# Coding conventions and how they are enforced

Everything mechanical is enforced by ESLint + Prettier; everything that is judgement is listed at
the bottom as review-only, so nobody assumes the linter is checking it.

## Files

| File | What it holds |
|---|---|
| `eslint.config.ts` | Flat config: base TypeScript rules, then overrides for React, tests, tooling, and the ban on JavaScript files |
| `.prettierrc.json` | Formatting mechanics: semicolons, single quotes, width 100, trailing commas |
| `.prettierignore` / `.editorconfig` | What Prettier skips; editor defaults |
| `tools/eslint-plugin-local/` | Local rules no off-the-shelf plugin covers |
| `tools/lint-fixtures/` | One fixture pair per custom rule, asserted by `pnpm lint:fixtures` |
| `scripts/check-lint-fixtures.ts` | Runs ESLint over the fixtures and fails if a custom rule stops firing |
| `scripts/check-agent-hook.ts` | Proves the agent hook still blocks a bad file and formats a clean one |
| `scripts/check-agent-parity.ts` | Proves `CLAUDE.md` → `AGENTS.md`, skill stubs, and Codex prompts are in sync |
| `scripts/check-coverage-gate.ts` | Proves an uncovered file still fails each gated package's coverage threshold |
| `scripts/check-changeset.ts` | Fails a pull request that changes `apps/` or `packages/` source without a changeset (the marketing page in `apps/site` is exempt, ADR-003) |
| `scripts/check-bundle-budget.ts` | Fails a web build whose entry, initial or lazy JavaScript is over its gzip budget (see [Bundle budgets](#bundle-budgets)) |
| `scripts/generate-third-party-notices.ts` | Writes `THIRD_PARTY_NOTICES.md` and the web build's `third-party-licenses.txt`; `pnpm check:licenses` fails a stale file or a license outside the permissive list |
| `.github/workflows/ci.yml` | Two jobs: `check` (install, the full check graph, then the gate assertions, the changeset check, and `format:check`) and `e2e` (the web app's Playwright suite in headless Chromium, report and traces uploaded on failure) |
| `.github/workflows/release.yml` | Turns landed changesets into a "Version Packages" pull request, then runs `scripts/tag-release.ts`: one `v<version>` tag and one GitHub Release for the whole app |
| `.husky/pre-commit` / `.husky/pre-push` | The two local git gates; installed by `prepare` on `pnpm install` |
| `.claude/hooks/lint-edited-file.ts` | The Claude Code `PostToolUse` hook, registered in `.claude/settings.json` |
| `tsconfig.base.json` | Shared compiler options: ES2022, `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` |
| `vitest.shared.config.ts` | The Vitest base every package config merges into: test layout, timeout, v8 coverage |
| `turbo.json` / `pnpm-workspace.yaml` | The task graph and the workspace members (`apps/*`, `packages/*`) |
| `packages/ui/.storybook/` / `packages/ui/stories/` | Storybook for `@nautink/ui`: every component and the design tokens, light and dark, with the a11y addon (`pnpm --filter @nautink/ui storybook`) |

Commands: `pnpm check` (lint, typecheck of the tooling and every package, test, build, the UI Storybook
build, bundle budget, license check), and individually `pnpm lint`, `lint:fix`, `lint:file`, `lint:fixtures`,
`lint:agent-hook`, `check:agents`, `test:coverage-gate`, `test:changeset-gate`, `check:bundle-budget`,
`test:bundle-budget-gate`, `test:release-tag`, `check:licenses`, `test:license-gate`, `typecheck`, `test`, `build`, `format`,
`format:check`.

## Enforced automatically

| Convention | Rule |
|---|---|
| PascalCase types, camelCase values, UPPER_CASE constants | `@typescript-eslint/naming-convention` |
| Booleans prefixed `is`/`has`/`can`/`should`/`did`/`will`/`was`/`are` | `naming-convention` (boolean selector, type-aware) |
| kebab-case file names | `unicorn/filename-case` |
| `err` as the catch binding | `unicorn/catch-error-name` |
| Explicit types on variables, parameters, members | `@typescript-eslint/typedef`, `no-inferrable-types` off on purpose |
| Explicit return types | `explicit-function-return-type`, `explicit-module-boundary-types` |
| Never `any` | `@typescript-eslint/no-explicit-any` (+ `strictTypeChecked` no-unsafe-* family) |
| No `!` and no compiler-silencing casts | `no-non-null-assertion`, `consistent-type-assertions` (`objectLiteralTypeAssertions: never`) |
| `import type` for type-only imports | `consistent-type-imports` |
| Functions under 20 lines, one responsibility | `max-lines-per-function` (20), `complexity` (10), `max-depth` (3) |
| 3+ parameters → RO-RO | `max-params: 3` |
| No blank lines inside a function body | `local/no-blank-lines-in-function` (autofixable) |
| Early returns over nesting | `no-else-return`, `max-depth` |
| `async`/`await` only, no `.then()` chains | `no-restricted-syntax`, `promise-function-async`, `no-floating-promises`, `no-misused-promises` |
| No nested ternaries | `no-nested-ternary` + a `no-restricted-syntax` selector |
| No magic numbers | `@typescript-eslint/no-magic-numbers` (warn; ignores −1/0/1, enums, defaults) |
| No mutation of inputs | `no-param-reassign` (`props: true`), `prefer-const`, `no-var` |
| Throw real errors, never swallow | `only-throw-error`, `no-useless-catch`, `prefer-promise-reject-errors` |
| No `console` / `debugger` / commented debris | `no-console`, `no-debugger`, `no-alert`, `no-warning-comments` |
| Explain WHY, not WHAT | `no-inline-comments` (warn) — the rest is review |
| Grouped, ordered imports with blank lines between groups | `import-x/order` |
| No barrel files | `local/no-barrel-file` |
| One primary export per file, named after the file | `import-x/no-default-export` |
| No import cycles, no cross-package relative imports | `import-x/no-cycle`, `import-x/no-relative-packages` |

Relaxed in tests (`*.test.ts(x)`, `*.spec.ts(x)`, `tests/**`): function length, magic numbers,
`typedef`, non-null assertions. Relaxed in config/tooling files: type-aware rules, default
exports, `console`. Storybook's config files and story files may default-export, as CSF requires;
nothing else is relaxed for them.

## Review-only — the linter cannot see these

- Naming by intent (`activeUsers`, not `userArray`); complete words over abbreviations.
- `interface` for entities and contracts, `type` for unions and mapped types.
- Extracting a cohesive unit with a real name instead of splitting mid-thought to satisfy the
  20-line limit.
- Complex conditions lifted into a named boolean before the `if`.
- Never returning `null`/`undefined` to signal failure; error messages that name the offending
  value.
- JSDoc on the exported surface only, one line, no `@param`/`@returns` that repeat the signature.
- SOLID checks, composition over inheritance, patterns applied only when they fit.
- Premature abstraction, god objects, clever code, dead scaffolding.

## Where the gates fire

| When | What runs |
|---|---|
| An agent writes a file | Claude Code `PostToolUse` hook: format, `eslint --fix`, feed leftovers back to the agent |
| `git commit` | Husky + lint-staged over staged files |
| `git push` | `pnpm lint` + `lint:fixtures` + `check:agents` + `test:changeset-gate` + `test:bundle-budget-gate` + `test:coverage-gate` |
| A pull request, and every push to `main` | The full check graph, the same gate assertions, the changeset check (pull requests only), then `format:check`; the e2e suite in a parallel job |

Warnings (`no-magic-numbers`, `no-inline-comments`, `no-warning-comments`) block the first two
gates and not the last two: an agent or a commit has to deal with them there and then, while a
push and CI let them through. That is deliberate — a warning is a prompt to think, not a reason
to block the branch.

## Bundle budgets

PRD §9 keeps the first load small and loads Monaco, the visual editors and the icon packs lazily.
`pnpm check` holds the web build to gzip budgets (Node's default gzip level) after `vite build`;
`scripts/check-bundle-budget.ts` holds the numbers and `pnpm test:bundle-budget-gate` proves they
still fire.

| Budget | Gzip | Measured when set |
|---|---|---|
| Entry script (`index-*.js`) | 168 kB | 160.2 kB |
| Initial JavaScript (entry + the chunks `index.html` preloads) | 249 kB | 236.7 kB |
| `monaco-setup` (the code drawer) | 1045 kB | 994.7 kB |
| `editor.worker` (Monaco's worker) | 97 kB | 92.4 kB |
| `elk-*` (Mermaid's ELK layout) | 472 kB | 449.0 kB |
| `editor-canvas` (React Flow and the shared canvas) | 61 kB | 57.9 kB |
| `flow-editor` / `class-editor` / `er-editor` / `state-editor` / `sequence-editor` | 16 / 20 / 13.7 / 18.5 / 26 kB | 15.2 / 19.1 / 13.0 / 17.5 / 24.4 kB |
| `compute-review` / `settings-fields` / `mini` (Motion, the live fade) | 3.3 / 4 / 3.4 kB | 3.1 / 3.8 / 3.2 kB |
| Any other lazy chunk (Mermaid's diagram types, KaTeX, Cytoscape, …) | 150 kB | largest 136.3 kB |

Each budget sits about 5% above its size when set. When the check fails, first make the new code
lazy (`import()` / `React.lazy`) or smaller; raise a budget only on purpose, in the same change,
and update this table. A named budget that matches no chunk also fails, so rename it when a chunk
is renamed.

## Workspace packages

- **Name and place.** Apps live in `apps/<name>` as `@nautink/<name>`; libraries in `packages/<name>` as
  `@nautink/<name>`. `packages/contracts` is the reference layout to copy.
- **No build step for libraries.** A package ships its TypeScript source: `"exports": { "./*": "./src/*.ts" }`,
  so imports name the file that owns the symbol (`@nautink/contracts/chat`). There is no `index.ts`
  (barrel files are banned). Only `apps/web` and `apps/server` build.
- **Relative imports keep their `.ts` extension** (`./chat.ts`), so Node can run the source directly.
  Only erasable TypeScript: no `enum`, no `namespace`, no constructor parameter properties.
- **tsconfig.** `{ "extends": "../../tsconfig.library.json", "include": ["src", "vitest.config.ts"] }`, plus
  `lib`/`types` for browser or Node packages.
- **Tests.** `vitest.config.ts` merges `vitest.shared.config.ts` and sets the package's coverage
  thresholds. A package with a threshold is listed in `GATED` in `scripts/check-coverage-gate.ts`.
- **Scripts.** `typecheck` (`tsc -p tsconfig.json`) and `test` (`vitest run`); turbo runs them for
  every package.

## App defaults

| What | Value |
|---|---|
| Web dev server | `http://localhost:5190` |
| API server | `http://127.0.0.1:8791` (localhost only) |
| IndexedDB name | `nautink` |
| Styling | Tailwind classes that use the `docs/PRD.md` §6 token variables. No hex colors in components; inline `style` only for computed canvas positions |

