---
"@nautink/web": minor
---

Add the workspace store backed by `@nautink/storage`: diagrams load from IndexedDB (a blank flowchart on first run), the open diagram is remembered, changes autosave after 400 ms and on page hide, and the top bar and status bar show the open diagram's title, type, line count and save state. The canvas shows the code as plain text until the preview lands.
