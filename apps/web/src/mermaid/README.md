# Mermaid in the web app

Every Mermaid call goes through this folder, so parse and render never overlap (Mermaid keeps
global state and fails when two calls run at once).

- `loadMermaid()`: lazy-loads Mermaid once and shares the instance.
- `initMermaid(isDark)`: v1's settings (strict security, plain-SVG labels). Call again on theme change.
  Icon packs are registered by the preview (it owns the Iconify loaders).
- `enqueueMermaid(job)`: runs `job` after every earlier job. Wrap every `parse` and `render` call in it.
  A job must never enqueue another job and wait for it.
- `validateMermaid(code)`: `null` when the code parses, otherwise `{ message, line }`.
- `renderThumbnail(code, isDark)`: a small picture as a data URL, rendered once per code and theme
  through the queue. `<DiagramThumbnail code={…} />` draws one lazily (history rows, the gallery).
