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

`options.selection` (`ChatSelection`) goes straight into the request: the selection wave (PRD §4.1)
only has to pass it.

## One turn

`runTurn` (`chat-turn.ts`) sends the message, then retries on its own up to `MAX_AUTO_FIX` (2) times
while the reply's diagram does not parse (`validateMermaid`). The whole turn is one undo step:
`TurnEdit` records the first code it shows with `applyEdit(…, { source: 'claude' })` and amends that
step for every streamed chunk and retry. Stop puts back the code from before the reply.

When the turn ends with a changed diagram that parses, `finishTurn` saves a `claude` version (and,
before the first one, a "Before Claude" version, as v1) and fires `nautink:versions-changed`
(`detail: { diagramId }`) on `window`.

The review wave (PRD §4.2) hooks in where code reaches the diagram: `TurnEdit.show` (live build)
and `settleCode` / `finishTurn` in `chat-turn.ts` (the final code, the version). Holding the final
code as a proposal instead of applying it is a change to those two places.

## Files

| File | What |
|---|---|
| `chat-client.ts` | `fetch` + SSE decoding into typed events |
| `chat-reply.ts` | Pure reducer: events → one reply → a stored `ChatMessage` |
| `extract-mermaid.ts` | v1's `extractMermaid` (partial fences) and `stripMermaid` |
| `auto-fix.ts` | Retry decisions, fix prompt, undo-step labels |
| `chat-turn.ts`, `turn-edit.ts`, `turn-messages.ts`, `turn-versions.ts` | One turn: messages, the undo step, versions |
| `chat-store.ts` | Session-only state: the streaming reply, its abort, change-card links, live-region text |
| `quick-actions.ts` | v1's quick-action prompts per diagram type, and the welcome examples |
| `*.tsx` | The panel's parts, the prompt bar, the live region; `use-chat-feature.ts` registers ⌘K and the fix listener |
