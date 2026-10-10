import { agentName } from './agent-name.ts';
import { fixPrompt, turnLabel } from './auto-fix.ts';
import { defaultChatDeps } from './chat-deps.ts';
import { useChatStore } from './chat-store.ts';
import { finishTurn, runTurn } from './chat-turn.ts';
import { TurnEdit } from './turn-edit.ts';
import { ProposalEdit } from './turn-proposal.ts';
import { rejectProposal } from '../review/review-actions.ts';
import { useReviewStore } from '../review/review-store.ts';
import { selectActiveDiagram } from '../workspace/use-workspace.ts';

import type { SendKind } from './auto-fix.ts';
import type { ChatDeps } from './chat-deps.ts';
import type { Turn } from './chat-turn.ts';
import type { TurnCodeSink } from './turn-edit.ts';
import type { AgentId } from '@nautink/contracts/agents';
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

/** Where the turn's code goes: the diagram, or a proposal when review is on (PRD §4.2). */
function codeSink(
  diagramId: string,
  deps: ChatDeps,
): Pick<Turn, 'edit' | 'isReviewing' | 'replyIndexes'> {
  const isReviewing: boolean = deps.shouldReview();
  const replyIndexes: number[] = [];
  const edit: TurnCodeSink = isReviewing
    ? new ProposalEdit({ diagramId, workspace: deps.workspace }, replyIndexes)
    : new TurnEdit(diagramId, deps.workspace);
  return { edit, isReviewing, replyIndexes };
}

/** Who answers the turn and what its undo step is called. The agent is read once per turn. */
function turnIdentity(
  prompt: string,
  options: SendOptions,
  deps: ChatDeps,
): Pick<Turn, 'agent' | 'label'> {
  const agent: AgentId = deps.agent();
  return {
    agent,
    label: turnLabel(options.kind ?? 'user', options.title ?? prompt, agentName(agent)),
  };
}

function createTurn(
  diagram: Diagram,
  input: { prompt: string; options: SendOptions; deps: ChatDeps },
): Turn {
  const { prompt, options, deps } = input;
  const identity: Pick<Turn, 'agent' | 'label'> = turnIdentity(prompt, options, deps);
  const controller: AbortController = new AbortController();
  useChatStore.getState().begin(diagram.id, controller, identity.agent);
  return {
    diagramId: diagram.id,
    workspace: deps.workspace,
    ...identity,
    before: diagram.code,
    prompt,
    selection: options.selection ?? null,
    ...codeSink(diagram.id, deps),
    signal: controller.signal,
    deps,
  };
}

async function runToEnd(turn: Turn, options: SendOptions): Promise<void> {
  const kind: SendKind = options.kind ?? 'user';
  let announcement: string = `${agentName(turn.agent)} could not reply.`;
  try {
    announcement = await finishTurn(
      turn,
      await runTurn(turn, { message: turn.prompt, kind, label: turn.label }),
    );
  } finally {
    useChatStore.getState().end(announcement);
  }
}

/**
 * Sends `text` about the open diagram and streams the reply into it, retrying on its own while the
 * diagram does not parse. Resolves `false` without sending when `canSendChat` is false. A proposal
 * still open on the diagram is rejected first: the new message asks about the unchanged code.
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
  rejectProposal(diagram.id);
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
  useReviewStore.getState().forget(diagramId);
}
