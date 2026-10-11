# Workspace core

The diagrams, the open one, autosave and undo/redo (PRD §3.5). Every later feature (preview, code
editor, chat, version history, visual editors) reads and changes diagrams through this folder, never
through `@nautink/storage` directly, so autosave and the edit history stay in step.

## The store

`useWorkspaceStore` (`use-workspace.ts`) is a Zustand store. Read it with a selector, or with the
hooks below; call actions with `useWorkspaceStore.getState().<action>()` outside React.

| Need | Use |
|---|---|
| The open diagram (`Diagram` from `@nautink/storage/records`) | `useActiveDiagram()`, or `selectActiveDiagram(state)` |
| Its id | `useWorkspaceStore((s) => s.activeId)` |
| Every diagram | `useWorkspaceStore((s) => s.diagrams)` (unordered; `sortDiagrams` for list order) |
| Save state (`saved` / `saving` / `error`) | `useSaveState()`; words in `SAVE_STATE_LABELS` |
| Load state | `useWorkspaceStore((s) => s.status)` (`idle` / `loading` / `ready` / `error`) |

Everything is written through autosave: ~400 ms after the last change, and at once when the page is
hidden or closed (`useWorkspaceLifecycle`, mounted by `App`). `flushSaves()` writes now; call it
before anything that reads the database directly (version snapshots, export). `requireDb()` hands out
the open database for stores the workspace does not own (versions); it throws before `load`.

## Changing a diagram

| Change | Action |
|---|---|
| Code | `applyEdit(code, { label, source, group?, sel?, diagramId? })` — see below |
| Chat messages | `updateMessages(id, (messages) => [...messages, next])` (append, replace, stream into the last one) |
| Claude session id | `setSessionId(id, sessionId \| null)` |
| Unsent chat text | `setDraft(id, draft)` |
| Preview / Edit / Split | `setView(id, view)` |
| Rename in place in the top bar (⌘K) | `requestTitleRename()` |
| Title, pin, duplicate, delete, download | `renameDiagram`, `togglePin`, `duplicateDiagram`, `deleteDiagram` (Undo notice), `downloadDiagram` |
| New / open | `createDiagram()` (blank flowchart), `selectDiagram(id)` |
| New from code (templates, imported files) | `createDiagrams([{ fields: { code, title?, view? }, step }])`: saves, opens the last |
| Backups | `exportBackup()`, `importBackup(parsedJson)` (Nautink or v1; throws `InvalidBackupError`) |
| Versions and other records of your own | `requireDb()` gives the open database; call `flushSaves()` first |

Messages and session id are typed with `ChatMessage` and `Diagram['sessionId']` from
`@nautink/storage/records`. A content change (code, chat, title) moves the diagram up the list.

## Code changes go through the history

`applyEdit` is the only way to change code. It records one labelled step in the open diagram's
undo/redo stack (`undo/edit-history.ts`, 200 steps, session only) and queues the save. It returns the
`EditEntry` that now holds the code.

- **Labels:** sentence case, past tense: "Typed in code", "Pasted code", "Moved Login",
  "Claude: Add a retry", "Restored version 3".
- **Sources:** `code`, `visual`, `claude`, `restore`, `import`, `template`, `duplicate`, `open`,
  `external`. The step menu shows them; undoing a `claude` or `restore` step shows a notice.
- **Typing (code editor):** pass `group: TYPING_GROUP`. Keystrokes merge into one step until a 1 s
  pause. Call `closeEditGroup()` on a cursor jump (mouse or arrow keys) and when the editor loses
  focus. A paste, cut or drop is its own step: no `group`. Pass `sel` so redo can restore the cursor.
- **One Claude turn = one step:** `applyEdit(result, { label: 'Claude: …', source: 'claude' })`,
  keep the returned `entry.id`, and send auto-fix retries through `amendEdit(entry.id, code)`; if it
  returns `false` (the user edited in between), record a new step instead. Both take the diagram's
  id (`diagramId` in the request, third argument of `amendEdit`) so a reply keeps landing in the
  diagram that asked even after the user opens another one.
- **Undo/redo:** `undo()`, `redo()`, `jumpTo(index)`. They change `code` in the store; an editor
  showing the code must follow the store, not keep its own undo stack.
- **Keyboard:** ⌘Z / ⌘⇧Z / ⌘Y run the history everywhere except text fields. A code editor that
  wants them (Monaco) puts `data-edit-history="app"` on its container (`undo/history-shortcuts.ts`).
- **History guard (`undo/history-guard.ts`):** another feature can take over undo for a diagram without
  the workspace importing it. `registerHistoryGuard({ undoInstead, runInstead, subscribe })` installs
  one (the result removes it). While `undoInstead(diagramId)` names something, `undo()` calls
  `runInstead(diagramId)` instead of moving, `redo()` and `jumpTo()` do nothing, the top bar says
  "Undo: <name>" with redo and the step menu off, and ⌘K enables Undo only. The review registers one
  (`review/review-history-guard.ts`, mounted by `App`): while Claude's proposal is open, undo
  rejects it ("Reject Claude's change").

## Files

| Path | What |
|---|---|
| `use-workspace.ts` | `useWorkspaceStore` and its hooks: the folder's public entry |
| `use-workspace-lifecycle.ts` | Writes queued changes when the page is hidden or closed |
| `store/` | The store factory (`workspace-store.ts`), its types (`workspace-state.ts`), autosave (debounced, ordered writes with retry), and the deps swapped in tests (database, notices, downloads, clock) |
| `actions/` | The store actions, grouped by concern (`*-actions.ts`, `load-action.ts`) |
| `undo/` | Pure undo/redo stacks (`edit-history.ts`), the history guard, the top bar ↶ ↷ with the step menu, and ⌘Z / ⌘⇧Z / ⌘Y |
| `commands/` | The workspace's ⌘K commands |
| `title/` | The diagram title in the top bar: inline rename and the save state label |
| `panel/` | The diagrams panel: search, type chips, the keyboard listbox, row menu, inline rename |
| `untouched.ts` | `isUntouchedWorkspace`: only the blank diagram of a first start (first run, restore) |
| `two-tab-notice.ts` | `BroadcastChannel('nautink')`: both tabs warn that their edits overwrite each other (PRD §11) |
| `blank-diagram.ts`, `text.ts`, `relative-time.ts`, `use-now.ts` | Shared helpers: the blank flowchart, title and label text, "2 min ago" |