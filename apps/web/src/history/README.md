# Version history

The open diagram's versions (PRD §3.5, M5): the History panel, ⌘S, compare, restore.

| Need | Use |
|---|---|
| The open diagram's versions, newest first (`null` while loading) | `useVersionsStore((s) => s.versions)` |
| The version count, for the status bar | `useVersionCount()`, words from `versionCountLabel(n)` |
| The version the panel is viewing, to show it read-only on the canvas | `useViewedVersion()` (`null` = the current code) |
| Tell the panel a diagram's versions changed (after a Claude edit) | `announceVersionsChanged(diagramId)`, or dispatch `nautink:versions-changed` with `{ diagramId }` |
| Save, restore, rename, delete | `version-actions.ts` |

Restore keeps the current code as a `restore` ("Before restore") version first, then loads the
version through `applyEdit(…, { source: 'restore' })`, so ⌘Z undoes it. The panel stops viewing a
version when it closes or another diagram opens.
