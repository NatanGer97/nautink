# ADR-004: Designs saved as files in a project folder
- **Status:** Accepted
- **Date:** 2026-10-10

## Context
ADR-001 and the PRD keep every diagram in the browser's IndexedDB. That suits a personal scratchpad,
but not the people Nautink now aims at: developers who plan a feature or a system change before they
build it. For them a design is only useful when it lives with the code:

- it is versioned in git and reviewed in a pull request with the change it describes;
- a coding agent (Claude Code, Codex) can read it as the plan for the work;
- teammates see it on GitHub, which renders Mermaid inside Markdown.

Today the only way to get a diagram into the repo is export or copy, by hand, every time it changes.
Nautink already has a local server that can read a folder the user picks (the codebase setting).

## Decision
- **Add a project folder mode next to browser storage.** The user picks a folder inside a repository
  (for example `docs/design/`). Nautink lists the `.md` and `.mmd` files in it and opens them as
  diagrams. Browser storage stays the default and keeps working with no folder chosen.
- **The file is the source of truth in folder mode.** A `.mmd` file is one diagram. A `.md` file can
  hold several Mermaid blocks plus prose; Nautink edits a block in place and leaves the rest of the
  file byte for byte unchanged.
- **The local server does the file access**, limited to the chosen folder (no path outside it, no
  symlinks out of it), with the same host guard and Zod validation as the chat route.
- **Saving writes the file.** Undo, redo and the version list stay in IndexedDB as local working
  history; git is the long-term history. Nautink does not run git commands.
- **Changes made outside Nautink are picked up.** The server watches the folder and tells the web app
  over SSE; if the open diagram has unsaved edits, Nautink asks which side to keep instead of
  overwriting.

## Consequences
- Designs become normal repo files: diffable, reviewable, readable by any coding agent with no
  Nautink-specific format.
- The local server gains write access to one user-chosen folder. SECURITY.md's threat model must cover
  it, and the folder choice must be explicit in the UI.
- Editing a block inside a larger Markdown file needs a parser that keeps the surrounding text exactly;
  that parser is the riskiest part and needs round-trip tests.
- Two writers (Nautink and an editor or agent) can touch the same file; the conflict prompt is
  required, not optional.
- Backups and the diagrams panel must show where each diagram lives (browser or folder).
- This ADR adds to ADR-001's storage decision; it does not replace it.
