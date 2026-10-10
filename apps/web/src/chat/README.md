# Chat with Claude

Sending a message, streaming the reply into the diagram, auto-fix, and the chat panel (PRD §3.1,
M1, M2). The server side is `POST /api/chat` (`@nautink/contracts/chat`, `/sse`).

## Sending

Every way of talking to Claude goes through `sendChat(text, options)` (`send-chat.ts`): the composer,
the floating prompt bar, the welcome examples, "Ask Claude to fix" and ⌘K.

| Need | Use |
|---|---|
| Send about the open diagram | `sendChat(text, { title?, selection? })`; `canSendChat(text)` first if you clear an input |
| Send the parse error back | `askClaudeToFix(message)`, or fire `nautink:ask-claude-to-fix` on `window` with `detail: { message, line }` |
| Stop / new chat | `stopChat()`, `startNewChat(diagramId)` (or `requestNewChat()`, which confirms first) |
| Know whether Claude is busy | `useChatStore((s) => s.busyDiagramId)` — one reply at a time, app-wide |

`options.selection` (`ChatSelection`) goes straight into the request.

## Selection → prompt (PRD §4.1)

1. The visual editor publishes its selection to `useCanvasSelectionStore`
   (`edit/selection/canvas-selection.ts`): Mermaid id, label and kind per item. Preview publishes
   nothing, so the chip shows in Edit and Split only.
2. `chat-selection.ts` turns the open diagram's selection into the chip's items. `SelectionChip`
   ("2 nodes selected", "3 items selected" for mixed kinds) shows them in the composer and the
   floating prompt bar. × calls `removeSelectionChip()`: the chip stays hidden until the selection
   changes (a new list in the store, even the same ids after a clear).
3. `submitDraft` sends `chatSelectionFor(diagramId)`: the ids, labels and kinds while the chip shows,
   null otherwise. Quick actions, welcome examples and "Ask Claude to fix" never send a selection.
4. The floating "Ask Claude about these N…" prompt (`edit/selection-prompt/`) always sends the
   selection it floats under, with `toChatSelection(items)`.
5. The server (`apps/server/src/prompt.ts`, `describeSelection`) adds the selection block: each item
   as `kind id: "label"`, and the rule to change only those items and their direct links and keep
   every other line byte-identical.

## One turn

`runTurn` (`chat-turn.ts`) sends the message, then retries on its own up to `MAX_AUTO_FIX` (2) times
while the reply's diagram does not parse (`validateMermaid`). The whole turn is one undo step:
`TurnEdit` records the first code it shows with `applyEdit(…, { source: 'claude' })` and amends that
step for every streamed chunk and retry. Stop puts back the code from before the reply.

When the turn ends with a changed diagram that parses, `finishTurn` saves a `claude` version (and,
before the first one, a "Before Claude" version, as v1) and fires `nautink:versions-changed`
(`detail: { diagramId }`) on `window`.

## Review on (PRD §4.2, §4.3)

"Review changes before applying" (`useUiStore` `shouldReviewChanges`, on by default; `deps.shouldReview`)
is read when a turn starts. With it on, the turn's code goes to a `ProposalEdit` (`turn-proposal.ts`)
instead of a `TurnEdit`: streamed chunks and auto-fix retries become the **live build**
(`useReviewStore` `live`), which the canvas shows read-only while the diagram's code, undo history
and versions stay untouched. Stop drops it. When the turn ends with changed code, `finishTurn`
opens a **proposal** (`open`) and compares it in the background (`deps.review` → `review/load-review.ts`,
a lazy chunk with `@nautink/editors/review/review-diagram`).

| Need | Use (`../review/`) |
|---|---|
| The code the canvas shows (live build, proposal with ghosts, or the diagram) | `useShownCode(diagram)` |
| The open proposal, its marks, why editing is off | `useOpenProposal(id)`, `useStructuralReview(id)`, `useReviewReadOnlyReason(id)` |
| Accept / Reject / Show again | `acceptProposal(id)` (one `claude` undo step + versions, as above), `rejectProposal(id)` (records nothing), `showProposalAgain(id, messageIndex)` while `showAgainBlocker(…)` is `null` |

The outcome is stored on the turn's replies (`ChatMessage.review`), so the change card says
"Applied · N changes" or "Rejected · diagram unchanged" after a reload; "Show again" only works in
the session (proposals are not saved) and only while the diagram still has the code from before the
turn. Sending a new message about a diagram rejects its open proposal first. Review off behaves
exactly as before. The bar (`review-bar.tsx`) floats over the canvas; a code-only review (types
without a visual editor, code that does not parse, text-only changes) shows its bar and Monaco's diff
in the code drawer. Enter accepts and Esc rejects unless the focus is on a field or control.

## Files

| File | What |
|---|---|
| `chat-client.ts` | `fetch` + SSE decoding into typed events |
| `chat-reply.ts` | Pure reducer: events → one reply → a stored `ChatMessage` |
| `extract-mermaid.ts` | v1's `extractMermaid` (partial fences) and `stripMermaid` |
| `auto-fix.ts` | Retry decisions, fix prompt, undo-step labels |
| `chat-turn.ts`, `turn-edit.ts`, `turn-messages.ts`, `turn-versions.ts` | One turn: messages, the undo step, versions |
| `turn-proposal.ts` | Review on: the live build, and the proposal a turn ends with |
| `chat-store.ts` | Session-only state: the streaming reply, its abort, change-card links, live-region text |
| `quick-actions.ts` | v1's quick-action prompts per diagram type, and the welcome examples |
| `chat-selection.ts`, `selection-chip.tsx` | The selection a message carries, and its removable chip |
| `*.tsx` | The panel's parts, the prompt bar, the live region; `use-chat-feature.ts` registers ⌘K and the fix listener |
