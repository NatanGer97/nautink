---
"@nautink/server": minor
---

Add `POST /api/chat`: runs the local Claude Code CLI with v1's lean flags and streams its reply as SSE events (`session`, `delta`, `turn`, `tool`, `done`, `error`). A canvas selection is added to the prompt so Claude limits its change to the selected nodes and their direct links.
