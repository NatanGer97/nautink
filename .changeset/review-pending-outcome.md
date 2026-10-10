---
"@nautink/storage": minor
"@nautink/web": patch
---

A reply whose proposal was still waiting when the page reloaded now says "Not applied" (it used to say "Diagram updated") and offers Review again, which rebuilds the proposal from the reply. Replies store a `pending` review outcome while their proposal waits.
