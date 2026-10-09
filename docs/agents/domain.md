# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

This repo is **single-context**: one root `CONTEXT.md` (when it exists) and one `docs/adr/` directory.

## Before exploring, read these

- **`AGENTS.md`** at the repo root: the single entry point, with the working agreements and the map of `docs/`.
- **`CONTEXT.md`** at the repo root, if it exists: the glossary of domain terms.
- **`docs/adr/`**: read ADRs that touch the area you're about to work in. They are numbered `NNN-slug.md` (`000-template.md` is the template).
- **`docs/PRD.md`**, once it exists: the product view, when the work is product-shaped rather than structural.

If `CONTEXT.md` doesn't exist, **proceed silently**. Don't flag its absence; don't suggest creating it upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates it lazily when terms actually get resolved.

## File structure

```
/
├── AGENTS.md          ← entry point (CLAUDE.md is a symlink to it)
├── CONTEXT.md         ← glossary, created lazily
└── docs/
    ├── PRD.md         ← the product view
    ├── adr/           ← 000-template.md, then 001-…, 002-…
    ├── plans/         ← one plan file per piece of work
    └── agents/        ← the SDLC pipeline and its procedures
```

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

**Never edit an accepted ADR** — that's a working agreement in `AGENTS.md`. Supersede it with a new, higher-numbered ADR instead.

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-NNN (the decision it records), but worth reopening because…_
