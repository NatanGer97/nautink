---
"@nautink/web": minor
"@nautink/storage": minor
---

Choose Claude or Codex in Settings (ADR-002). The connection row, the model select, the model chip and the ⌘K model commands follow the chosen agent, and the UI names it ("Ask Codex to fix", "Codex proposes 3 changes"). Each diagram's session belongs to one agent, so switching agents starts a new session. Replies, agent versions and sessions remember which agent wrote them; older records count as Claude's.
