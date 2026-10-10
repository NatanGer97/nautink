---
"@nautink/editors": minor
---

State diagrams: `Id : text` now parses as the state's description (as in Mermaid) and is written back as `Id : text`; only `state "Name" as Id` sets a display name. This is a recorded deviation from v1, which made the first description the display name.
