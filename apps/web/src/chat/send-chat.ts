import { fixPrompt, turnLabel } from './auto-fix.ts';
import { defaultChatDeps } from './chat-deps.ts';
import { useChatStore } from './chat-store.ts';
import { finishTurn, runTurn } from './chat-turn.ts';
import { TurnEdit } from './turn-edit.ts';
import { selectActiveDiagram } from '../workspace/use-workspace.ts';

import type { SendKind } from './auto-fix.ts';
import type { ChatDeps } from './chat-deps.ts';
import type { Turn } from './chat-turn.ts';
import type { ChatSelection } from '@nautink/contracts/chat';
import type { Diagram } from '@nautink/storage/records';

/** How a message is sent. Every way of talking to Claude (composer, prompt bar, chips) uses it. */
export interface SendOptions {
  /** `user` (default), or `fix` for "Ask Claude to fix". `auto` is for the retry loop only. */
  kind?: SendKind;
  /** Names the undo step instead of the message, such as a quick action's label. */
  title?: string;
  /** Nodes Claude should limit its change to (PRD §4.1). The selection wave passes them. */
  selection?: ChatSelection | null;
}

/** The open diagram, when a message can be sent now: text, a diagram, and no reply streaming. */
function sendTarget(text: string, deps: ChatDeps): Diagram | undefined {
  const isIdle: boolean = useChatStore.getState().busyDiagramId === null;
  return text.trim() !== '' && isIdle ? selectActiveDiagram(deps.workspace()) : undefined;
}

/** True when `text` would be sent now. */
export function canSendChat(text: string, deps: ChatDeps = defaultChatDeps()): boolean {
  return sendTarget(text, deps) !== undefined;
}

function createTurn(
  diagram: Diagram,
  input: { prompt: string; options: SendOptions; deps: ChatDeps },
): Turn {
  const { prompt, options, deps } = input;
  const controller: AbortController = new AbortController();
  useChatStore.getState().begin(diagram.id, controller);
  return {
    diagramId: diagram.id,
    workspace: deps.workspace,
    before: diagram.code,
    prompt,
    selection: options.selection ?? null,
    edit: new TurnEdit(diagram.id, deps.workspace),
    signal: controller.signal,
    deps,
  };
}

async function runToEnd(turn: Turn, options: SendOptions): Promise<void> {
  const kind: SendKind = options.kind ?? 'user';
  const label: string = turnLabel(kind, options.title ?? turn.prompt);
  let announcement: string = 'Claude could not reply.';
  try {
    announcement = await finishTurn(
      turn,
      await runTurn(turn, { message: turn.prompt, kind, label }),
    );
  } finally {
    useChatStore.getState().end(announcement);
  }
}

/**
 * Sends `text` about the open diagram and streams the reply into it, retrying on its own while the
 * diagram does not parse. Resolves `false` without sending when `canSendChat` is false.
 */
export async function sendChat(
  text: string,
  options: SendOptions = {},
  deps: ChatDeps = defaultChatDeps(),
): Promise<boolean> {
  const diagram: Diagram | undefined = sendTarget(text, deps);
  if (diagram === undefined) {
    return false;
  }
  await runToEnd(createTurn(diagram, { prompt: text.trim(), options, deps }), options);
  return true;
}

/** v1's "Ask Claude to fix": sends the parse error back as one undo step labelled as a fix. */
export async function askClaudeToFix(
  errorMessage: string,
  deps: ChatDeps = defaultChatDeps(),
): Promise<boolean> {
  return sendChat(fixPrompt(errorMessage), { kind: 'fix' }, deps);
}

/** Stops the streaming reply. The code goes back to what it was before that reply. */
export function stopChat(): void {
  useChatStore.getState().stop();
}

/** Clears a diagram's messages and Claude session, stopping its reply if one streams. */
export function startNewChat(diagramId: string, deps: ChatDeps = defaultChatDeps()): void {
  const chat: ReturnType<typeof useChatStore.getState> = useChatStore.getState();
  if (chat.busyDiagramId === diagramId) {
    chat.discard();
  }
  deps.workspace().updateMessages(diagramId, () => []);
  deps.workspace().setSessionId(diagramId, null);
  chat.forgetReplyEdits(diagramId);
}
