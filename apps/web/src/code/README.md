# Code drawer

Monaco in the code drawer (PRD §3.2, M3): Mermaid highlighting, light/dark themes from the PRD tokens,
autocomplete per diagram type, the parse error marker, and one model per diagram.

- **Lazy:** `load-monaco.ts` imports `monaco-setup.ts` (the lean core in `monaco-core.ts`, the worker,
  the language, the themes, autocomplete) the first time the drawer mounts. Nothing else may import
  Monaco at runtime; type-only imports of `monaco-editor/editor/editor.api.js` are fine.
- **History:** typing goes through `applyEdit(…, { source: 'code', group: TYPING_GROUP })`; paste,
  cut and drop are steps of their own; a click, an arrow key or blur closes the typing group. The
  container has `data-edit-history="app"`, so ⌘Z is the app's history, never Monaco's.
- **External changes** (undo, Claude, visual edits) reach the model as one minimal edit
  (`syncModel`), so the cursor and scroll outside the change stay put.
- **Ask Claude to fix:** the drawer dispatches `window` event `nautink:ask-claude-to-fix` with
  `{ message, line }` (`ask-claude-to-fix.ts`); the chat listens for it.

| File | What |
|---|---|
| `code-editor.tsx` | The editor, its load state and the footer (error + "Ask Claude to fix", cursor) |
| `use-monaco-editor.ts` | Loads Monaco, creates and disposes the editor, follows the theme |
| `use-model-sync.ts` | One model per diagram; store → model minimal edits; disposes deleted diagrams' models |
| `use-edit-recording.ts` | Editor → `applyEdit`, typing groups, paste/cut/drop |
| `use-error-markers.ts` | The preview's parse error as a Monaco marker |
| `editor-binding.ts` | Pure helpers: diff span, model URIs, markers, labels |
| `mermaid-language.ts`, `monaco-themes.ts`, `mermaid-completion.ts`, `completion-snippets.ts` | Language, themes, autocomplete (ported from v1) |
