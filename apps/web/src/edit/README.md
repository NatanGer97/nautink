# Edit mode and the visual editors

The canvas's **Preview / Edit / Split** views (PRD §3.3, §3.4, §4.4) and the host every visual editor
plugs into. `flow/` (the flowchart editor) is the reference editor: copy its shape.

The view is saved on the diagram (`diagram.view`, set with `setView` or `switchView`). Types without
an editor keep Edit and Split off in the top bar with the reason (M7); if a diagram's view is Edit
anyway (Claude changed its type), Edit says "No visual editor for <type> yet. Use code or chat." and
Split falls back to the preview alone.

## Adding an editor (class, ER, state, sequence)

Everything an editor needs is shared; an editor is **one folder plus one registry line**.

1. Create `edit/<id>/` (`<id>` is the `EditorId`: `class`, `er`, `state`, `sequence`).
2. Export the component from `edit/<id>/<id>-editor.tsx`:

   ```tsx
   export function ClassEditor(props: VisualEditorProps): ReactElement {
     return (
       <ReactFlowProvider>
         <ClassCanvas {...props} />
       </ReactFlowProvider>
     );
   }
   ```

3. Add its line to `VISUAL_EDITORS` in `editor-registry.ts`:

   ```ts
   class: lazyEditor(async () => (await import('./class/class-editor.tsx')).ClassEditor),
   ```

   That is the only shared file you touch. Each editor (and React Flow) loads as its own chunk the
   first time it is shown; never import an editor folder from anywhere else.

Do not import from another editor's folder. If you need something another editor has, move it to
the shared folders below in a separate commit and say so.

## The contract

### Props: `VisualEditorProps` (`editor-props.ts`)

| Prop | What |
|---|---|
| `diagramId` | The open diagram. Positions and the selection are kept per diagram |
| `code` | The code to show: the diagram's, or a viewed version's |
| `isDark` | The app's theme |
| `readOnlyReason` | Why the canvas is read-only now (Claude is editing, an older version is on view), or null |
| `canSavePositions` | False while an older version is on view |
| `onChange(code, label)` | Records the code as one undo step: `applyEdit(code, { label, source: 'visual' })` |

The host remounts the editor (fresh model and positions) when the diagram, the viewed version or the
diagram type changes.

### `useEditorCore` (`use-editor-core.ts`): sync, positions, read-only, fit

```ts
const core = useEditorCore({ props, module: classEditor, layout: CLASS_LAYOUT });
```

- `module` is the editor's `EditorModule` from `@nautink/editors` (`parse`, `serialize`, `id`).
- `layout` is a **module-level constant** `EditorLayout<Model>`:
  `place(model, positions) → Placement` (keep known items, place new ones; `isFullLayout` when it
  laid everything out again), `layout(model) → PositionMap` (dagre, for "Auto layout") and optional
  `tag(model, positions)` (v1's `tagLabels`, run before every commit). Layouts that measure text
  (class, ER, sequence) close over `canvasTextMeasurer` from `canvas/text-measurer.ts` (canvas-backed,
  cached; 7 px per character in jsdom).

It returns:

| Field | What |
|---|---|
| `model`, `getModel()` | The parsed model (null until the first parse). Use `getModel()` inside event handlers |
| `failure` | The last parse failure, or null |
| `commit(next, label)` | Serialize and record one labelled undo step. Labels: sentence case, past tense, from `editLabel` / `deleteLabel` (`@nautink/visual-core/labels`) |
| `readOnlyReason`, `isReadOnly` | The host's reason, or a syntax error / another diagram type. `isReadOnly` is also true before the first parse |
| `book`, `positions` | `PositionBook` (`get`, `set(id, point)`, `move(ids, delta)`, `replace(map)`) and its current map |
| `fitRequest`, `requestFit()` | Fit requests: first open, full layouts, Auto layout |
| `autoLayout()` | Lays everything out again (canvas only, no code change) |

What it does for you (port of v1's `sync.js` + `positions.js`):

- **Parse** with Mermaid's own parser through the shared queue (`sync/mermaid-loader.ts`): at once
  on open, then 300 ms after the code stops changing (120 ms while Claude streams).
- **Never re-parses code the editor wrote**: a commit does not move anything.
- **Outside changes** (typing, undo/redo, Claude, a restore) re-parse and call `layout.place`, so
  known items keep their spot and new ones go next to a neighbour.
- **Undo/redo** belong to the store: the editor keeps no undo stack and has no undo buttons (PRD §3.4).
  ⌘Z / ⌘⇧Z / ⌘Y are bound app-wide; never bind them in an editor.
- **A syntax error** keeps the last model on the canvas, read-only, with a calm banner.
- **Positions** load from IndexedDB before the first parse (`@nautink/storage/positions`, one record
  per diagram and editor id, as v1's `mc.positions.<diagramId>.<ns>`), and save 400 ms after a change,
  never while an older version is on view. Delete, duplicate, backup and restore carry them already.

### Canvas chrome (`canvas/`)

| Piece | What |
|---|---|
| `EditorCanvas` | React Flow as every editor uses it: token colors, Delete/Backspace, Shift/⌘ multi-select, read-only, the zoom bar, fit requests (keeping the prompt bar's room free), the read-only banner. Pass `flow` (nodes, edges, nodeTypes, events), `isDark`, `isReadOnly`, `readOnlyReason`, `fitRequest`, `rootRef`, and the chrome as children |
| `EditorToolbar`, `ToolbarIconButton`, `ToolbarTextButton`, `ToolbarSelect`, `ToolbarSeparator`, `ToolbarHelp` | The floating tools card (M1), top-left. Put "Library", "Add …", "Auto layout" and your tips here |
| `InspectorCard`, `InspectorSection`, `InspectorActions`, `InspectorButton` | The floating inspector (M1), top-right, 248 px. Show it only while something is selected |
| `CommitField`, `ChoiceField`, `SelectField` | v1's `Field` (commits on blur/Enter, Esc reverts), `Seg` (segmented) and a select with groups |
| `CanvasHint` | A quiet hint on an empty canvas |
| `useWindowKeys(rootRef, handle)` | Canvas shortcuts while nothing else has focus (fields always keep their keys) |
| `useFitNow()` | Fits now, around the prompt bar (for a ⇧1 shortcut) |
| `react-flow-theme.css` | React Flow variables mapped to the PRD §6 tokens. Style your nodes with Tailwind token classes only |
| `canvasTextMeasurer` | The `TextMeasurer` `@nautink/editors` layouts take |

Libraries (`library/`): `LibraryPanel` (the floating tabbed panel under the toolbar), `LibraryItem`
(a tile you click or drag), `LibrarySearch`, and `IconLibrary` (the Icons tab: logos, mdi, Font
Awesome, Carbon, each pack fetched on demand through `icons/icon-packs.ts`). `IconGlyph` draws an
icon (sanitized SVG).

### The selection store (`selection/canvas-selection.ts`)

Other features read what is selected on the canvas from here, never from an editor:

```ts
const { diagramId, items } = useCanvasSelection(); // items: { id, label, kind }[]
selectionSummary(items); // "2 nodes selected" — for the composer chip (PRD §4.1)
```

An editor **must**:

- call `publishSelection(diagramId, items)` whenever its selection changes, with `id` = the
  **Mermaid id** (node id, class name, entity name, state id) so Split can find the shape in the
  render, `label` = the item's display name, and `kind` = a noun (`node`, `link`, `group`, `class`,
  `entity`, `state`, `message` …);
- call `clearSelection()` when it unmounts;
- answer `useSelectionRequests(diagramId, select)`: Split's preview half asks the editor to select
  the ids of a clicked shape.

`flow/use-flow-editor.ts` (`useSelectionSync`) is the reference.

### Read-only and Claude

The host passes `readOnlyReason` while Claude streams into the diagram (`busyDiagramId`) or the
history panel views an older version. The canvas must not change code then (`EditorCanvas` turns off
dragging, connecting and deleting; disable your own tools with `core.isReadOnly`). Positions may still
move while Claude streams; they are never saved while a version is viewed.

## Tests

- Pure logic (actions, selection reducers, element builders, key handling) as plain `*.test.ts`
  next to the file; `tests/flow-fixtures.ts` shows an in-memory action context.
- The editor component renders in jsdom with React Flow: see `flow/flow-editor.test.tsx`. Mock
  `../positions/app-position-store.ts` with a `MemoryPositionStore`; Mermaid's real parser runs.
  `requestSelection(diagramId, ids)` selects items without pointer events.
- End to end: `e2e/edit.spec.ts` and the helpers `switchView`, `canvasNode`, `dragBy`, `centerOf`
  in `e2e/helpers.ts`. Give your nodes `data-testid="<id>-node-<mermaid id>"`-style test ids.

## Files

| File | What |
|---|---|
| `canvas-view.tsx`, `split-view.tsx`, `canvas-views.ts`, `view-commands.ts`, `use-view-commands.ts` | The three views, the top bar toggle's rules and the ⌘K commands (main bundle) |
| `edit-canvas-loader.tsx` → `edit-canvas.tsx` | The lazy Edit chunk: picks the editor, hands it its props, the viewed-version bar |
| `editor-registry.ts`, `editor-props.ts` | The registry and the props contract |
| `edit-notices.tsx`, `read-only-reason.ts` | No-editor and empty states; read-only reasons |
| `sync/` | `DiagramSync` (v1's `useDiagramSync` outside React), its hook, the Mermaid loader |
| `positions/` | `PositionBook`, its hook and the IndexedDB adapter |
| `use-editor-core.ts` | Sync + positions + read-only + fit, for every editor |
| `selection/`, `split-mirror.ts` | The selection store and Split's mirroring |
| `canvas/`, `library/`, `icons/` | Shared chrome |
| `flow/` | The flowchart editor |
