# Mockups (M1–M8)

Design reference for `docs/PRD.md`, exported from the mockup canvas
(https://claude.ai/artifact/4w9jxWVEL22BWP6BVi39Gf). They are reference markup, not code to copy: each file is
one screen as static HTML with inline styles, so the exact sizes, spacing and colors can be read from it.
The colors and sizes are also listed as tokens in `docs/PRD.md` §6, which wins where the two differ.

| # | File | Screen |
|---|---|---|
| M1 | `M1-edit-selection.html` | Edit with selection-aware AI (light) |
| M2 | `M2-review.html` | Review Claude's change (dark) |
| M3 | `M3-library.html` | Library and code drawer (light) |
| M4 | `M4-split.html` | Split: edit next to the real render, export menu |
| M5 | `M5-history.html` | Version history and compare (dark) |
| M6 | `M6-templates.html` | New diagram gallery |
| M7 | `M7-code-only.html` | Code-only type (Gantt) and undo steps |
| M8 | `M8-first-run.html` | First run and settings |

The files load `./support.js` from the canvas runtime and Google Fonts, so they do not render on their own.
Read them as markup.
