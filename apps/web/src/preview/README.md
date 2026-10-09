# Preview canvas

The canvas in Preview mode (PRD §3.3, M1): the open diagram rendered by Mermaid, with pan, zoom, fit
and focus mode. Mermaid runs only through `../mermaid/` (the shared queue).

## Seams for other features

| Need | Use |
|---|---|
| Validity (`valid` / `invalid` / `empty`), the `MermaidError`, render time, the last good SVG | `usePreviewStatus()`; outside React `usePreviewStatusStore.getState()` |
| Focus mode (rail and panels hidden) | `useIsFocusMode()`, `useFocusModeStore.getState().setFocusMode(on)` |
| A click on a rendered shape | `<PreviewCanvas onShapeClick={(element) => …} />` |

`svg` in the status belongs to `diagramId`; it is kept while the code does not parse, and dropped when
another diagram fails before it ever rendered.

## Files

| File | What |
|---|---|
| `render-diagram.ts` | Parse + render through the queue, theme init, icon pack registration |
| `use-diagram-render.ts` | Debounced (250 ms) render of the open diagram into the status store |
| `preview-status.ts` | The status store and `usePreviewStatus()` |
| `view-math.ts`, `view-controller.ts`, `use-pan-zoom.ts` | Pan, zoom and fit; the view stays fitted until the user pans or zooms |
| `preview-canvas.tsx`, `zoom-controls.tsx`, `parse-error-notice.tsx` | The UI |
| `preview-commands.ts`, `focus-mode.ts` | ⌘K commands, focus mode and its Esc |
