# Export

The top bar's Export menu (PRD §3.6, M4), its ⌘K commands and the ⇧⌘E / ⇧⌘C shortcuts. Ported from
v1's `export.js` and `ExportMenu.jsx`.

- **Images** (SVG, PNG, copy image, copy SVG) need the current render: the preview status must be
  `valid` for the open diagram. **Text** (code, Markdown, HTML embed, mermaid.live) needs code.
- **What you see is what you export:** while the history panel views an older version, every export
  uses that version's code and render.
- `appExportActions` runs every export and shows a toast for the result; `readExportSource()` reads
  the diagram and its render at that moment. `createExportActions(getSource, deps)` builds them with
  other browser dependencies (tests).
- The PNG scale and transparency live in `usePngChoiceStore`, so ⇧⌘C copies with the menu's choice.

| File                                      | What                                                    |
| ----------------------------------------- | ------------------------------------------------------- |
| `export-menu.tsx`                         | The menu; mounts `useExportCommands()` (⌘K + shortcuts) |
| `export-actions.ts`, `app-export.ts`      | The actions, availability, browser dependencies         |
| `export-formats.ts`, `svg-to-png.ts`      | Markdown, HTML embed, mermaid.live link; SVG → PNG      |
| `use-export-commands.ts`, `png-choice.ts` | ⌘K commands, shortcuts, PNG choice                      |
