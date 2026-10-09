# Lint fixtures

Each file under `invalid/` must produce exactly the rule IDs listed in its `EXPECT:` header,
and each file under `valid/` must produce none. `pnpm lint:fixtures` asserts both.

These files are excluded from the normal `pnpm lint` run (see `ignores` in `eslint.config.ts`),
so a deliberately broken fixture never breaks the repo gate.

Add one fixture pair per custom rule you write, so a future edit to `eslint.config.ts`
that silently disarms a rule fails `pnpm lint:fixtures` instead of shipping.
