---
"@nautink/web": patch
---

Check every main state with axe (WCAG 2.1 AA and 2.2 AA's target size) in light and dark, and walk the workspace with the keyboard. Fixes what it found: the diagram row's ⋯ button no longer sits focusable inside a listbox option (the list opens the same menu with Shift+F10), start and end states in the state editor have a role for their name, and the undo history button is 24 px wide.
