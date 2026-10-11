---
'@nautink/server': patch
'@nautink/web': patch
'@nautink/storage': patch
'@nautink/visual-core': patch
---

Group source files by domain. The server splits into `agents/`, `chat/`, `info/`, `repo/` and
`http/`; the web app's `workspace/` into `store/`, `actions/`, `undo/`, `commands/` and `title/`;
`@nautink/storage` into `db/`, `diagrams/`, `versions/` and `backup/`; `@nautink/visual-core` into
`contract/`, `canvas/`, `text/` and `icons/`. Both packages now list their exports explicitly, so
every import path stays the same. No behavior change.
