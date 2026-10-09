# ADR-001: Tech stack for v2
- **Status:** Accepted
- **Date:** 2026-10-09

## Context
`docs/PRD.md` §7.1 proposes a stack for the TypeScript rebuild. A few choices were left open: the
server framework, the IndexedDB layer, how strict the lint rules are for React components, and when
Storybook arrives.

## Decision
- **TypeScript only.** No `.js`, `.jsx`, `.mjs` or `.cjs` files anywhere, tooling included. Node 22 runs
  the gate scripts directly by stripping their types, so they use erasable TypeScript only; the root
  `tsconfig.json` type-checks them. ESLint loads `eslint.config.ts` through `jiti`. A lint rule fails
  any JavaScript file, and a lint fixture proves it fires.
- **Monorepo:** pnpm workspaces + Turborepo. Packages: `apps/web`, `apps/server`, `packages/ui`,
  `packages/contracts`, `packages/storage`, `packages/visual-core`, `packages/editors`.
- **Web:** React 19, TypeScript strict, Vite 8, Tailwind CSS v4, shadcn/ui (Radix) restyled to the
  PRD §6 tokens, lucide-react, cmdk, sonner, react-resizable-panels, Motion, Zustand, Zod 4. Geist and
  Geist Mono self-hosted from the `geist` package.
- **Diagrams and editors:** mermaid 12, Monaco 0.57 (lean core build, as v1), Monaco's DiffEditor for
  diffs, @xyflow/react 12, @dagrejs/dagre, the v1 Iconify packs.
- **Server:** Node 22 + Express 5, so v1's bridge ports almost line by line. SSE written by hand. Zod
  validates every request.
- **Storage:** IndexedDB through `idb`, keeping v1's schema.
- **Tests:** Vitest 5 + coverage-v8, React Testing Library, fake-indexeddb, Playwright.
- **Lint:** the repo's strict rules everywhere, except `.tsx` files get 60 lines per function instead of
  20. Vendored shadcn/ui files are exempt from the code-style rules.
- **Storybook:** deferred to the polish phase. Accessibility is checked with Playwright + axe until then.

## Consequences
- Porting v1's server and storage is mostly translation, not redesign.
- Component files can stay readable as one function per component; logic stays in small `.ts` functions.
- Storybook and its a11y checks land late, so early UI work relies on Playwright for regressions.
