# Nautink (Mermaid Chat v2): product spec

| | |
|---|---|
| Status | Accepted as the v2.0 scope |
| Date | 2026-10-09 |
| Baseline (v1) | `~/dev/mermaid-chat` (local only), commit `dd9c011` ("Add unified undo/redo history per diagram") |
| Target (v2) | This repository (`NatanGer97/nautink`), TypeScript, intended for open-source release |
| Design reference | Mockup canvas: https://claude.ai/artifact/4w9jxWVEL22BWP6BVi39Gf (8 screens, referenced below as **M1–M8**) |

All `src/…` and `server/…` paths below are v1 paths in `~/dev/mermaid-chat`. The mockups are a design reference, not code. v2 is built fresh in TypeScript, porting v1's logic where this spec says so and replacing its UI shell.

---

## 1. Goals and non-goals

### Goals
1. **Canvas-first, production-grade UI.** The diagram is the primary object; chat, code and the visual editor shape it. The UI must look calm and deliberate, not like a generic AI template.
2. **Full feature parity with v1.** Every v1 feature in §3 exists in v2, in the place §3 names, before v2 replaces v1.
3. **AI-native editing.** Selection-aware prompts and a review step (accept/reject) for Claude's changes (§4).
4. **Enterprise and open-source ready.** Typed, tested, accessible (WCAG 2.2 AA), documented, with a clean license story (§9, §10).

### Non-goals (v2.0)
- Hosting for other users or accounts. v2 stays a local app driving the user's own Claude Code CLI, like v1.
- Real-time multi-user collaboration.
- A marketing site. React Bits and similar effect libraries are for that later site only (§6.8).
- New diagram types beyond v1's five visual editors.

---

## 2. Principles

- **One accent, used sparingly.** Ink blue marks selection, focus and active state only. Primary actions use the near-black/near-white "ink" fill, not the accent.
- **Typography carries hierarchy, not decoration.** No gradients, glows, sparkle icons or emoji in the UI.
- **Floating things float; everything else is flat.** Shadows only on popovers, floating toolbars and dialogs.
- **Keyboard first.** Every action is reachable from the ⌘K palette; frequent ones have shortcuts.
- **Nothing is lost.** Undo covers every change, version history covers every Claude edit, restores are undoable (as in v1).
- **Code is the source of truth.** The canvas and chat edit Mermaid code; the code is always valid to copy elsewhere.

---

## 3. Feature parity matrix (v1 → v2)

Every row must ship in v2.0. "Change" notes where behavior intentionally differs.

### 3.1 Chat and Claude

| v1 feature | v1 reference | v2 location | Change |
|---|---|---|---|
| Chat with streaming replies, stop, new chat | `src/Chat.jsx`, `src/App.jsx` (`send`), `src/api.js` | Chat panel, left of canvas (M1, M2) | Reply text may stream into the canvas as a live build (§4.3) |
| Claude via local CLI, session resume, lean flags | `server/index.js` (`claudeArgs`, `--resume`, `--setting-sources project`, `--strict-mcp-config`) | Same server bridge, ported to TypeScript (§7.4) | None |
| System prompt (shapes, icon packs, UML guidance) | `server/index.js` `SYSTEM_PROMPT` | Same, versioned in `server/prompt.ts` | Add selection and review context (§4) |
| Auto-fix retry loop (2 retries on parse error) | `src/App.jsx` (`MAX_AUTO_FIX`, `validate`) | Same | Retries merge into one undo step (as v1) |
| "Ask Claude to fix" on parse error | `src/App.jsx` pane header button | Status bar error + inline action in code drawer | None |
| Quick-action chips (per diagram type) | `src/Chat.jsx` `COMMON_ACTIONS`, `TYPE_ACTIONS` | Under each Claude reply (M1) and in the prompt bar | Shown after replies, not only above the composer |
| Per-message Diff and Restore | `src/Chat.jsx` `Message`, `src/DiffView.jsx` | Change card in the reply: "Diff", "Undo" (M1) | Restore lives in History |
| Model picker (default, Opus, Sonnet, Haiku) | `src/App.jsx` header select | Chat header chip + Settings default (M1, M8) | None |
| Repo-aware mode (`REPO_DIR`, Read/Grep/Glob) | `server/index.js` | Settings: "Codebase Claude can read" (M8); repo badge in top bar | Folder chosen in UI, not only by env var |
| Tool steps ("Read file…") | `src/Chat.jsx` `tools` | Steps list in the reply (M2) | None |
| ⌘/ focus chat | `src/App.jsx` keydown | Same | None |

### 3.2 Code editor

| v1 feature | v1 reference | v2 location | Change |
|---|---|---|---|
| Monaco with Mermaid highlighting, light/dark themes | `src/monaco.js`, `src/monaco-core.js` | Code drawer (M3, M7) or split | Keep the lean Monaco core build |
| Autocomplete per diagram type, shapes, icon prefixes | `src/monaco-complete.js` | Same | Port to TS |
| Error marker on failing line | `src/App.jsx` `setModelMarkers` | Same | None |
| Per-diagram Monaco models (no cross-diagram undo) | `src/App.jsx` | Same | None |

### 3.3 Preview and canvas

| v1 feature | v1 reference | v2 location | Change |
|---|---|---|---|
| Mermaid render, pan, zoom, fit | `src/Preview.jsx` | Canvas in **Preview** mode (M1) | Same render queue |
| Serialized render queue | `src/renderQueue.js` | Same | None |
| Click a shape → jump to its code line | `src/locate.js`, `src/Preview.jsx` | Preview mode and Split's preview half (M4) | Also selects the node on the canvas in Split |
| Fullscreen preview | `src/App.jsx` `fullscreen` | Focus mode: hide rail and panels | None |
| Icon packs registered for Mermaid | `src/visual/icons.js` `mermaidIconPacks` | Same | None |
| Code and Visual tabs | `src/App.jsx` tabs | **Preview / Edit / Split** switch in top bar (M1, M4) | Split = visual editor beside the real render (decision §11) |
| Type chooser for empty diagram | `src/visual/VisualEditor.jsx` `Chooser` | First-run screen (M8) and New gallery (M6) | None |

### 3.4 Visual editors (Edit mode)

The five editors and their contract port as-is (logic in TypeScript, new UI chrome).

| v1 feature | v1 reference | v2 change |
|---|---|---|
| Editor contract, two-way sync, positions | `src/visual/README.md`, `src/visual/shared/sync.js` (`useDiagramSync`), `src/visual/shared/positions.js` | Keep contract; types in `packages/visual-core` (§7.2) |
| Flowchart: 53 shapes, library sidebar, groups, auto layout | `src/visual/flow/*` (`library.js`, `shapes.jsx`, `Library.jsx`, `layout.js`) | Library opens from the canvas toolbar "Library" (M1) |
| Icon nodes (logos, mdi, fa6, carbon) | `src/visual/icons.js`, `src/visual/flow/Library.jsx` | Icons tab in the library, plus toolbar "Add icon" (M1) |
| UML class editor | `src/visual/class/*` | Same features; restyle to tokens (M3) |
| Sequence editor | `src/visual/sequence/*` | Same |
| ER editor | `src/visual/er/*` | Same |
| State editor | `src/visual/state/*` | Same |
| Inspector per editor | `src/visual/*/Inspector.jsx` | Floating inspector card (M1) |
| Labelled commits `commit(next, label)` | `src/visual/shared/sync.js` `editLabel`, `deleteLabel` | Same |
| Editor toolbar Undo/Redo buttons | each editor's `.palette` | **Removed**: undo/redo live in the top bar only (fixes v1 duplicate) |

### 3.5 Workspace, history, undo

| v1 feature | v1 reference | v2 location | Change |
|---|---|---|---|
| Many diagrams in IndexedDB, one record each | `src/storage.js` (`newDiagram`, stores `diagrams`, `versions`) | Same schema (§7.3) | Typed; DB name `mermaid-chat-v2` |
| Diagram list: search title + content, pin, rename, duplicate, download, delete with undo | `src/Sidebar.jsx`, `src/workspace.js` | Diagrams panel from the rail (M3) | Adds type filter chips |
| Auto titles | `src/workspace.js` `autoTitle` | Same | Also read titles from `pie title`, `gantt title` (v1 gap) |
| Per-diagram code, chat, session, mode, positions | `src/App.jsx`, `src/storage.js` | Same | Chat draft kept per diagram (v1 gap) |
| Version history: Claude snapshots, ⌘S named saves, before-restore, cap 50 | `src/storage.js` `addVersion`, `MAX_VERSIONS`; `src/History.jsx` | History panel from the rail; compare drawer (M5) | Viewing a version shows it on the canvas, read-only |
| Unified undo/redo, labelled steps, ⌘Z/⌘⇧Z/⌘Y | `src/editHistory.js`, `src/UndoRedo.jsx` | Top bar ↶ ↷ with step menu (M7) | None |
| Import `.mmd`/`.md` by drop or picker | `src/workspace.js` `readDiagramFiles`, `src/App.jsx` drop overlay | Diagrams panel footer, drop overlay, first-run (M8) | None |
| JSON backup export/import | `src/storage.js` `exportAll`, `validateBackup`, `importAll` (`BACKUP_FORMAT`, `BACKUP_VERSION`) | Settings (M8) | Must import v1 backups (§8) |

### 3.6 Creation, export, chrome

| v1 feature | v1 reference | v2 location | Change |
|---|---|---|---|
| New diagram: 14 types, 19 starters (14 examples + 5 blanks for the visual types) | `src/templates.js`, `src/NewMenu.jsx` | Gallery dialog with categories (M6) | "Use example" and "Blank" per card |
| Export: SVG, PNG (scale, transparent), copy image/SVG/code/Markdown/HTML embed, mermaid.live | `src/export.js`, `src/ExportMenu.jsx` | Export menu in top bar (M4) | None |
| ⌘K command palette | `src/CommandPalette.jsx`, `src/App.jsx` `commands` | "Search or run…" in top bar | shadcn Command (cmdk) |
| Status bar: type, validity, save state, counts, render time, model | `src/StatusBar.jsx` | Same footer (M1) | None |
| Theme: system / light / dark | `src/App.jsx` `useTheme`, `index.html` bootstrap | Settings (M8) | None |
| Resizable panes | `src/Splitter.jsx`, `src/App.jsx` `sizes` | Chat panel, side panels, code drawer, split divider | react-resizable-panels |
| Toasts | `src/Toast.jsx` | Sonner | None |

---

## 4. New in v2

### 4.1 Selection-aware prompts (M1)
- Selecting nodes on the canvas shows a small floating prompt under the selection: "Ask Claude about these N…", plus a Group action.
- The chat composer shows a chip for the selection ("2 nodes selected") that can be removed.
- The prompt sent to Claude includes the selected node ids and labels, with an instruction to limit changes to them and their direct links unless asked otherwise.
- **Done when:** a prompt with a selection changes only the selected nodes in at least 9 of 10 scripted test prompts; the chip can be removed so the prompt applies to the whole diagram.

### 4.2 Review Claude's change (M2)
- Setting **Review changes before applying**, on by default.
- On reply, the canvas shows a proposal overlay: added (dashed green), changed (accent outline plus "edited" tag), removed (red strike-through). A bar reads "Claude proposes N changes" with **Reject** and **Accept ⏎**.
- Accept applies the change as one undo step and one `claude` version (as v1). Reject leaves code unchanged and records nothing.
- Code-only diagram types show the proposal as a code diff in the drawer instead.
- **Done when:** accept, reject, undo-after-accept and "show again" all work for all five visual types plus a code-only type.

### 4.3 Live build while streaming
- As Mermaid code streams, new nodes fade in on the canvas (Motion, under 150 ms). The canvas is read-only during streaming (as v1).

### 4.4 Split mode (M4)
- Edit and Preview side by side with a resizable divider. Selection is mirrored between the two halves. Click-to-line works in the preview half.

### 4.5 First run and settings (M8)
- Empty state: one prompt box with a diagram-type picker, example chips, and "start from" cards (blank, templates, import, from a codebase).
- Settings: appearance, default model, Claude Code connection status, codebase folder, backup and restore.

---

## 5. Layout and information architecture

```
┌ Top bar 48 ─ logo / diagram title ▾ · saved │ Preview|Edit|Split · Code │ ↶ ↷ · ⌘K · Export ┐
├ Rail 52 ┬ Panel (Chat 360 | Diagrams 296 | History 320) ┬ Canvas (flex) ┬ Code drawer 400–420 ┤
│ Diagrams│                                                │  floating:    │  (optional)          │
│ Chat    │                                                │  tools TL     │                      │
│ History │                                                │  inspector TR │                      │
│ Templates│                                               │  zoom BR      │                      │
│ ⋮       │                                                │  prompt bar   │                      │
│ Settings│                                                │  bottom-center│                      │
└ Status bar 28 ─ type · validity · saved │ lines · versions · render ms ───────────────────────────┘
```

- One rail panel is open at a time (Chat, Diagrams or History). The panel collapses to give the canvas full width.
- The floating prompt bar shows when the chat panel is closed (M3, M7), or under a selection (M1).
- **Narrow windows (under 1024 px):** panels become overlays (Sheet) over the canvas; the code drawer becomes a bottom sheet.
- **Code-only types** (Gantt, pie, mindmap, …): Edit and Split are disabled with an explanation (M7).

---

## 6. Design system

Source of truth: the mockup values below, expressed as CSS variables mapped to shadcn's theme variables.

### 6.1 Color tokens

| Token | Light | Dark | Use |
|---|---|---|---|
| `--background` (ground) | `#F7F7F5` | `#121211` | App and canvas background |
| `--card` / `--panel` | `#FFFFFF` | `#1A1A19` | Panels, bars, cards |
| `--muted` (panel-2) | `#F2F1EE` | `#232321` | Hover, segmented track, user bubble |
| `--subtle` | `#FBFBFA` | `#1E1E1C` | Card headers, inputs |
| `--border` | `#E6E4DF` | `#2C2C2A` | Default hairline |
| `--border-subtle` | `#F0EEEA` | `#232321` | Dividers inside panels |
| `--input` / `--border-strong` | `#D6D3CC` | `#3A3A37` | Buttons, fields, composer |
| `--foreground` | `#1B1B19` | `#EDEDEB` | Text, ink fill for primary buttons |
| `--muted-foreground` | `#5E5C57` | `#A8A6A0` | Secondary text |
| `--faint` | `#8C8A84` | `#7A7873` | Meta, placeholders |
| `--accent-ink` (`--ring`) | `#3451D1` | `#9AAEFF` | Selection, focus, active |
| `--accent-ink-strong` | `#2B44B0` | `#C2CEFF` | Accent text on accent backgrounds |
| `--accent-wash` | `#EEF1FD` | `#1E2440` | Selected rail item, chips |
| `--selection-ring` | `#E3E8FC` | `#2A3366` | 3 px halo around selected nodes |
| `--success` / bg | `#1F7A52` / `#E7F4EC` | `#4CC38A` / `#15291F` | Added, valid |
| `--destructive` / bg | `#B4362F` / `#FBEAE8` | `#F07A72` / `#2E1716` | Removed, errors, delete |
| `--warning` / bg | `#8A6A1C` / `#FBF2DC` | `#E5C46B` / `#2E2A1A` | Before-restore, notices |
| `--node-fill` / `--node-stroke` | `#FFFFFF` / `#CFCCC4` | `#1E1E1C` / `#3F3E3A` | Canvas nodes |
| `--edge` | `#9A978F` | `#77756F` | Canvas links |
| `--grid-dot` | `#DAD7D0` | `#2A2A27` | 20 px dot grid |

Rules: never use the accent for primary buttons (those use the ink fill). Contrast for text is at least 4.5:1. Diff colors must differ in lightness, not hue alone.

### 6.2 Typography
- **Families:** Geist (UI) and Geist Mono (code, kbd, numbers in meters). Self-hosted, not loaded from Google Fonts at runtime.
- **Scale (px):**
  - 11: badges and kbd only
  - 12: meta and helper text
  - 13: base UI
  - 14: panel titles and app name
  - 16: dialog titles
  - 28: first-run heading
- **Code:** 12.5 / 20 line height.
- **Weights:** 400, 500 and 600 only.

### 6.3 Spacing, size, radius, elevation
- **Spacing:** 4 px grid. Panel padding 12–16. Gaps 4, 6, 8, 10, 12, 16.
- **Bar heights:** top bar 48, rail 52 wide, status bar 28, panel headers 44.
- **Control heights:** 32, compact 26–28.
- **Radius:**
  - 6: controls
  - 8: segmented tracks, small cards
  - 10: cards, menus, composer
  - 12: floating panels
  - 14: dialogs
- **Elevation:**
  - in-flow: none
  - floating toolbars: `0 4px 16px rgb(27 27 25 / .06)`
  - menus and popovers: `0 12px 32px rgb(27 27 25 / .14)`
  - dialogs: `0 24px 64px rgb(27 27 25 / .24)`
  - dark mode uses black at higher alpha

### 6.4 Motion
- **Library:** Motion.
- **Durations:** 120–180 ms, ease-out. Panels slide; menus fade and scale from 98%; nodes fade in during a live build.
- **Accessibility:** respect `prefers-reduced-motion`.

### 6.5 Iconography
- lucide-react at 16 px, 1.6 stroke. Every icon-only button has `aria-label` and a tooltip with its shortcut.

### 6.6 Components (shadcn/ui mapping)

| Need | Component |
|---|---|
| Rail, panels | Sidebar, Sheet (narrow) |
| Pane sizing, split | Resizable |
| Palette | Command |
| Menus (Export, title, undo steps, row actions) | DropdownMenu, ContextMenu |
| Preview/Edit/Split, segmented controls | ToggleGroup |
| Dialogs (New gallery, confirm) | Dialog, AlertDialog |
| Inspector, settings | Popover, Card, Select, Switch, Slider |
| Tooltips | Tooltip |
| Toasts | Sonner |
| Lists | ScrollArea |
| Badges (type, version kind) | Badge |

### 6.7 Voice
- Sentence case everywhere. Buttons are verb first ("Restore this version").
- No "successfully", "please" or exclamation marks.
- Empty states invite an action.

### 6.8 Explicitly not used in the app
React Bits and similar effect libraries: they are flashy, can be heavy, and React Bits uses an MIT + Commons Clause license, which conflicts with a clean MIT release. They may be considered for a future marketing site only.

---

## 7. Architecture

### 7.1 Stack
- **App:** React 19 + TypeScript (strict), Vite, Tailwind CSS v4, shadcn/ui (Radix), lucide-react, cmdk, sonner, react-resizable-panels, Motion.
- **Data and editors:** Zustand (state), Zod (backup, import and server payload validation), @xyflow/react, Monaco (lean core build as in `src/monaco-core.js`), mermaid 12, Iconify packs (as `src/visual/icons.js`).
- **Tooling:**
  - Vitest for units and Playwright for end-to-end tests (porting v1's scratch suites into the repo).
  - Storybook with the a11y addon.
  - ESLint, Prettier, Husky, and CI on GitHub Actions.

### 7.2 Repository layout (proposed)
```
apps/web/            React app (shell, panels, canvas host)
apps/server/         Node bridge to the claude CLI (from server/index.js)
packages/visual-core/  Editor contract, sync hook, positions, labels (from src/visual/shared)
packages/editors/    flow, class, sequence, er, state (from src/visual/*), model/ops/layout in TS
packages/ui/         shadcn components + tokens
packages/storage/    IndexedDB schema, versions, backup (from src/storage.js)
packages/contracts/  Zod schemas for the server API and SSE events, shared by web and server
docs/                spec, ADRs, contributing
```
pnpm workspaces. Each editor's `model.ts` and `ops.ts` stay pure functions with unit tests (v1 has round-trip scripts to port).

### 7.3 Data model
Port v1 shapes as TypeScript types.
- **`Diagram`:** `{ id, title, titleAuto, code, mode, messages, sessionId, pinned, createdAt, updatedAt }`. Source: `src/storage.js` `newDiagram`. v2 adds `draft` (unsent chat text) and `view: 'preview' | 'edit' | 'split'`, replacing `mode`.
- **`Version`:** `{ id, diagramId, code, createdAt, kind: 'claude' | 'manual' | 'restore', label, prompt }`, capped at `MAX_VERSIONS = 50`.
- **`EditEntry`:** `{ code, label, source, time, sel?, group }`. Source: `src/editHistory.js`. Cap 200, in memory.
- **Positions:** `mc.positions.<diagramId>.<ns>`. Source: `src/visual/shared/positions.js`. Move into IndexedDB in v2.

### 7.4 Server contract
Keep v1's endpoints and Server-Sent Events (SSE), typed with Zod.
- `GET /api/info` → `{ repoDir }`
- `POST /api/chat { message, code, sessionId, model }` streams SSE events:
  - `session { sessionId, model }`
  - `delta { text }`
  - `turn {}`
  - `tool { label }`
  - `done { sessionId, text, isError, durationMs, costUsd }`
  - `error { message }`
- **Additions:**
  - `selection` in the chat body (§4.1).
  - `GET /api/health`, reporting whether the claude CLI is found, for M8.
  - `POST /api/repo` to set the codebase folder; restricted to directories under the user's home, and reported in the UI.
- **Unchanged:** bind to `127.0.0.1` only; spawn without a shell; kill the child on client disconnect.

---

## 8. Migration from v1
- v2 runs on a different origin or port, so it cannot read v1's IndexedDB directly.
- **Supported path:** v1 "Export all" JSON (`format: 'mermaid-chat-backup'`, `version: 1`), then v2 "Restore backup". v2's importer accepts v1 backups unchanged, including versions and positions.
- **First-run hint:** "Coming from v1? Restore its backup."

---

## 9. Quality bar

- **Accessibility:** WCAG 2.2 AA.
  - Full keyboard use, including canvas node selection and moving with arrow keys.
  - Visible focus rings (`--ring`).
  - Screen-reader names for icon buttons; a live region for streaming and review.
  - Storybook a11y checks pass.
- **Performance:**
  - Initial JavaScript under 1.5 MB gzipped; Monaco, editors and icon packs lazy-loaded.
  - Canvas interactions at 60 fps up to 300 nodes.
  - Preview render under 150 ms for 100-node flowcharts.
- **Browsers:** latest Chrome, Edge, Safari and Firefox.
- **Tests:**
  - Unit: round-trip for every editor, plus ops.
  - End-to-end: every row in §3 and every item in §4.
  - Visual regression on key screens in light and dark.
- **CI:** typecheck, lint, unit, end-to-end (headless), build, license check.

---

## 10. Open-source readiness
- **License:** MIT (as v1), plus THIRD_PARTY_NOTICES carried over from v1's README. Font Awesome (CC BY 4.0) needs attribution.
- **Repository files:** CONTRIBUTING, CODE_OF_CONDUCT, SECURITY (local-only threat model: the server drives the user's Claude login), issue templates.
- **Name:** Nautink (decided 2026-10-09). "Mermaid Chat" was dropped because it could be confused with official Mermaid products.
- **No telemetry.**

---

## 11. Decisions and open questions

| # | Topic | Status |
|---|---|---|
| D1 | Canvas-first layout (direction A) | Decided |
| D2 | Split view = visual editor beside the real render (option 2) | Decided |
| D3 | shadcn/ui + Tailwind v4 + TypeScript; Motion; no React Bits in the app | Decided |
| D4 | New repository; v1 stays as the reference until parity | Decided |
| Q1 | Product name for publishing | Decided: Nautink |
| Q2 | Review-before-apply default on or off | Proposed: on |
| Q3 | Keep visual edits in place (edit only the changed lines, preserving comments) instead of re-serializing | Proposed for v2.1 |
| Q4 | Edge routing that avoids crossing boxes (ELK or custom router) | Proposed for v2.1 |
| Q5 | Package manager and monorepo tool | Decided: pnpm workspaces + Turborepo (ADR-001) |

### Known v1 issues to fix in v2
- Duplicate undo/redo on the canvas toolbar and the top bar (§3.4).
- Auto titles miss `pie title` and `gantt title` (§3.5).
- Chat drafts are not kept per diagram.
- Two open tabs overwrite each other (last write wins). Add a BroadcastChannel lock or warning.
- Long links cross unrelated boxes in class, state and flowchart editors (Q4).
- The ER preview shows `#quot;` literally (Mermaid renderer). Avoid emitting quotes in ER labels, or document it.

---

## 12. Delivery plan

| Phase | Scope | Exit criteria |
|---|---|---|
| 0. Foundations | Repo, tooling, CI, tokens, shadcn components, Storybook | Tokens match §6; CI green |
| 1. Shell | Top bar, rail, panels, status bar, ⌘K, theme, resizable layout | M1/M3/M8 chrome matches mockups in light and dark |
| 2. Core loop | Server bridge, chat streaming, auto-fix, Monaco drawer, preview canvas, click-to-line | §3.1–3.3 rows pass end-to-end |
| 3. Workspace | Storage, diagrams panel, versions, history, undo, import/backup (v1 compatible) | §3.5 rows pass; v1 backup imports |
| 4. Editors | Port five editors to TS; Edit and Split modes; library and icons | §3.4 rows pass; round-trip suites green |
| 5. AI-native | Selection prompts, review accept/reject, live build | §4 done criteria met |
| 6. Polish and release | Accessibility audit, performance budgets, docs, notices, name | §9 and §10 met; v2.0 tag |
