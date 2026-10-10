---
"@nautink/editors": minor
---

Add `reviewDiagram` (`review/review-diagram.ts`): compares Claude's proposed code with the current code for the five visual types and returns the counts of added, changed and removed elements, the code to show (the proposal with removed elements kept as ghosts) and the marked elements. Types without a visual editor, and proposals that do not parse, are reviewed as code.
