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
| `scripts/check-changeset.ts` | Fails a pull request that changes `apps/` or `packages/` source without a changeset |
| `.github/workflows/ci.yml` | Install, the full check graph, then the gate assertions, the changeset check, and `format:check` |
| `.github/workflows/release.yml` | Turns landed changesets into a "Version Packages" pull request, then tags and releases |
| `.husky/pre-commit` / `.husky/pre-push` | The two local git gates; installed by `prepare` on `pnpm install` |
| `.claude/hooks/lint-edited-file.ts` | The Claude Code `PostToolUse` hook, registered in `.claude/settings.json` |
| `tsconfig.base.json` | Shared compiler options: ES2022, `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` |
| `vitest.shared.config.ts` | The Vitest base every package config merges into: test layout, timeout, v8 coverage |
| `turbo.json` / `pnpm-workspace.yaml` | The task graph and the workspace members (`apps/*`, `packages/*`) |

Commands: `pnpm check` (lint, typecheck of the tooling and every package, test, build), and individually `pnpm lint`,
`lint:fix`, `lint:file`, `lint:fixtures`, `lint:agent-hook`, `check:agents`, `test:coverage-gate`,
`test:changeset-gate`, `typecheck`, `test`, `build`, `format`, `format:check`.

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
exports, `console`.

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
| `git push` | `pnpm lint` + `lint:fixtures` + `check:agents` + `test:changeset-gate` + `test:coverage-gate` |
| A pull request, and every push to `main` | The full check graph, the same gate assertions, the changeset check (pull requests only), then `format:check` |

Warnings (`no-magic-numbers`, `no-inline-comments`, `no-warning-comments`) block the first two
gates and not the last two: an agent or a commit has to deal with them there and then, while a
push and CI let them through. That is deliberate — a warning is a prompt to think, not a reason
to block the branch.
