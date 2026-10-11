# @nautink/storage

## 0.1.0

### Minor Changes

- b1e3cb9: A reply whose proposal was still waiting when the page reloaded now says "Not applied" (it used to say "Diagram updated") and offers Review again, which rebuilds the proposal from the reply. Replies store a `pending` review outcome while their proposal waits.
- e02b55e: Add JSON backup: `exportAll` writes a `nautink-backup` (version 1) with diagrams, versions and positions; `validateBackup` and `importAll` also accept Mermaid Chat (v1) backups and merge like v1, giving clashing ids new ids.
- 9235eb5: Add the `nautink` IndexedDB database with typed diagram, version and position records, and the canvas positions store per diagram and editor.
- 12529f1: Add the diagram repository: create, get, list (pinned first, then most recent), put, update, duplicate, and delete with a restore for undo.
- 16fd23c: Add the optional `review` field to a chat message: whether the user accepted or rejected the change the reply proposed, and how many changes it had.
- 360e66e: Add `putVersion`, which saves a version record as it is (used to undo a version delete).
- ffb6cc1: `updateDiagram` now sets `updatedAt` when the code, chat or title changes, and auto titles also read the `title` of journey, timeline, xychart and quadrant charts.
- 26dd3ca: Add version history per diagram: add (skips unchanged code, keeps 50 and prunes the oldest unnamed first), list newest first, count, rename and delete.
- 5c94ab1: Add the workspace helpers: auto titles (now also from `pie title` and gantt `title` lines), diagram type names, list order, title and content search, and reading `.mmd`/`.md` files into diagram drafts.
- 9b17976: Choose Claude or Codex in Settings (ADR-002). The connection row, the model select, the model chip and the ⌘K model commands follow the chosen agent, and the UI names it ("Ask Codex to fix", "Codex proposes 3 changes"). Each diagram's session belongs to one agent, so switching agents starts a new session. Replies, agent versions and sessions remember which agent wrote them; older records count as Claude's.

### Patch Changes

- 23a1c74: Declare the MIT license in every package.
- Updated dependencies [ab08618]
- Updated dependencies [f07f71c]
- Updated dependencies [23a1c74]
- Updated dependencies [9b17976]
  - @nautink/contracts@0.1.0
