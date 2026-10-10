---
"@nautink/web": patch
---

Stop the page from shaking when a diagram re-renders: Mermaid now draws in a hidden fixed container instead of at the end of the page, so no scrollbar flashes when you add a shape.
