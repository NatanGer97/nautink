---
"@nautink/web": minor
---

Review Claude's change before it applies (PRD §4.2): with the setting on, a reply streams in as a live preview and ends as a proposal. The canvas marks what is added, changed and removed (Preview, Edit and Split, all five visual editors), the code drawer shows the diff, and a bar offers Reject and Accept ⏎ (Esc and Enter). Accept is one undo step and one `claude` version; Reject records nothing and the reply says "Rejected" with "Show again". Types without a visual editor are reviewed as a diff in the code drawer.
