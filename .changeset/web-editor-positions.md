---
"@nautink/web": minor
---

Keep visual editor positions in IndexedDB per diagram and editor (as v1 kept them per editor kind), loaded when the editor opens and saved a moment after each change, never while an older version is on view. Items without a saved spot are laid out with dagre, and editors get an "Auto layout" action.
