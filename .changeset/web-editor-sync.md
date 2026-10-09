---
"@nautink/web": minor
---

Add the visual editor host: the code is parsed into the editor model with Mermaid's own parser and edits go back through the undo history as labelled steps; outside changes (typing, undo, Claude, a restore) re-parse without moving existing items, a syntax error keeps the last canvas read-only, and the canvas is read-only while Claude edits or an older version is on view. The current selection lives in a small store, and Split mirrors it between the editor and the render.
