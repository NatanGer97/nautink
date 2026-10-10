import { agentName } from './agent-name.ts';
import { nextAutoFix, turnLabel } from './auto-fix.ts';
import { streamChat } from './chat-client.ts';
import { applyChatEvent, failReply, settleReply, startReply } from './chat-reply.ts';
import { useChatStore } from './chat-store.ts';
import { extractMermaid } from './extract-mermaid.ts';
import { findTurnDiagram } from './turn-edit.ts';
import { appendExchange, sessionFor, writeReply, writeSession } from './turn-messages.ts';
import { proposeTurn } from './turn-proposal.ts';
import { saveTurnVersions } from './turn-versions.ts';

import type { AttemptResult, SendKind } from './auto-fix.ts';
import type { ChatDeps } from './chat-deps.ts';
import type { ChatReply } from './chat-reply.ts';
import type { TurnCodeSink } from './turn-edit.ts';
import type { MessageTarget } from './turn-messages.ts';
import type { ChatEvent, ChatRequest, ChatSelection } from '@nautink/contracts/chat';

/** One message of a turn: what the user sent, or an automatic retry. */
export interface Attempt {
  message: string;
  kind: SendKind;
  /** Names the edit step if this attempt has to record one. */
  label: string;
}

/** A user's message and its automatic retries, merged into one edit step and one version. */
export interface Turn extends MessageTarget {
  /** The code when the turn started. */
  before: string;
  /** What the user asked, saved with the version. */
  prompt: string;
  /** Names the turn's undo step. */
  label: string;
  selection: ChatSelection | null;
  /** The diagram itself (review off), or a proposal held for review (review on, PRD §4.2). */
  edit: TurnCodeSink;
  isReviewing: boolean;
  /** The assistant messages of the turn, filled in as attempts run. */
  replyIndexes: number[];
  signal: AbortSignal;
  deps: ChatDeps;
}

function buildRequest(turn: Turn, attempt: Attempt): ChatRequest {
  const diagram: ReturnType<typeof findTurnDiagram> = findTurnDiagram(
    turn.workspace(),
    turn.diagramId,
  );
  return {
    message: attempt.message,
    code: diagram?.code ?? turn.before,
    sessionId: sessionFor(diagram, turn.agent),
    agent: turn.agent,
    model: turn.deps.model(),
    selection: turn.selection,
  };
}

/** Live build (PRD §4.3): the open ```mermaid block goes into the diagram as it streams. */
function handleEvent(
  turn: Turn,
  attempt: Attempt,
  update: { reply: ChatReply; event: ChatEvent },
): void {
  const { reply, event } = update;
  writeReply(turn, reply);
  if (event.type === 'session' || event.type === 'done') {
    writeSession(turn, reply.sessionId);
  }
  const partial: string | null =
    event.type === 'delta' ? extractMermaid(reply.text, { isPartial: true }) : null;
  if (partial !== null && partial.trim() !== '') {
    turn.edit.show(partial, attempt.label);
  }
}

async function streamReply(turn: Turn, attempt: Attempt): Promise<ChatReply> {
  let reply: ChatReply = startReply(null);
  try {
    await streamChat({
      request: buildRequest(turn, attempt),
      signal: turn.signal,
      fetchImpl: turn.deps.fetchImpl,
      onEvent: (event: ChatEvent): void => {
        reply = applyChatEvent(reply, event);
        handleEvent(turn, attempt, { reply, event });
      },
    });
    reply = settleReply(reply, agentName(turn.agent));
  } catch (err) {
    reply = failReply(reply, err, turn.signal.aborted);
  }
  writeReply(turn, reply);
  return reply;
}

/** The reply's final diagram into the turn's step; a stop puts back the code from before. */
function settleCode(
  turn: Turn,
  attempt: Attempt,
  outcome: { reply: ChatReply; codeBefore: string },
): string | null {
  if (outcome.reply.status === 'stopped') {
    turn.edit.revert(outcome.codeBefore);
    return null;
  }
  const code: string | null = extractMermaid(outcome.reply.text);
  if (code !== null) {
    turn.edit.show(code, attempt.label);
  }
  return code;
}

/** Links the reply's change card to the turn's step and tells the user about a hidden error. */
function reportAttempt(
  turn: Turn,
  outcome: { reply: ChatReply; code: string | null; messageIndex: number },
): void {
  const { entryId } = turn.edit;
  if (outcome.code !== null && entryId !== null && outcome.messageIndex >= 0) {
    useChatStore
      .getState()
      .linkReplyEdit(turn.diagramId, { messageIndex: outcome.messageIndex, entryId });
  }
  if (outcome.reply.status === 'error' && !turn.deps.isChatOpen()) {
    const name: string = agentName(turn.agent);
    turn.deps.notifyError(`${name} could not reply. ${outcome.reply.error ?? ''}`.trim());
  }
}

async function runAttempt(turn: Turn, attempt: Attempt, retries: number): Promise<AttemptResult> {
  const codeBefore: string = findTurnDiagram(turn.workspace(), turn.diagramId)?.code ?? turn.before;
  const messageIndex: number = appendExchange(turn, { text: attempt.message, kind: attempt.kind });
  if (messageIndex >= 0) {
    turn.replyIndexes.push(messageIndex);
  }
  const reply: ChatReply = await streamReply(turn, attempt);
  const code: string | null = settleCode(turn, attempt, { reply, codeBefore });
  reportAttempt(turn, { reply, code, messageIndex });
  const isCheckable: boolean = code !== null && reply.status === 'done';
  const error: AttemptResult['error'] = isCheckable ? await turn.deps.validate(code ?? '') : null;
  return { status: reply.status, code, error, retries };
}

/** Sends `first`, then retries on its own while the reply's diagram does not parse (v1). */
export async function runTurn(turn: Turn, first: Attempt): Promise<AttemptResult> {
  let result: AttemptResult = await runAttempt(turn, first, 0);
  let prompt: string | null = nextAutoFix(result);
  while (prompt !== null) {
    const label: string = turnLabel('auto', prompt, agentName(turn.agent));
    const retry: Attempt = { message: prompt, kind: 'auto', label };
    result = await runAttempt(turn, retry, result.retries + 1);
    prompt = nextAutoFix(result);
  }
  return result;
}

/** What the live region says when `name`'s turn ends. */
export function turnAnnouncement(result: AttemptResult, name: string): string {
  if (result.status === 'stopped') {
    return `${name} stopped.`;
  }
  if (result.status === 'error') {
    return `${name} could not reply.`;
  }
  if (result.code === null) {
    return `${name} replied.`;
  }
  return result.error === null
    ? `${name} updated the diagram.`
    : `${name} updated the diagram, but it still has a syntax error.`;
}

/** The turn's new code when it ended with a changed diagram that parses, else `null`. */
function savedCode(turn: Turn, result: AttemptResult): string | null {
  const isValid: boolean = result.status === 'done' && result.error === null;
  return isValid && result.code !== turn.before ? result.code : null;
}

/**
 * Ends the turn: with review on, a changed diagram becomes a proposal; otherwise a changed, valid
 * diagram is saved as a version. Returns the announcement.
 */
export async function finishTurn(turn: Turn, result: AttemptResult): Promise<string> {
  if (turn.isReviewing) {
    return (await proposeTurn(turn, result)) ?? turnAnnouncement(result, agentName(turn.agent));
  }
  return saveTurn(turn, result);
}

async function saveTurn(turn: Turn, result: AttemptResult): Promise<string> {
  const after: string | null = savedCode(turn, result);
  try {
    if (after !== null) {
      const { diagramId, before, prompt, agent } = turn;
      await saveTurnVersions({
        db: turn.workspace().requireDb(),
        diagramId,
        before,
        after,
        prompt,
        agent,
      });
    }
  } catch (err) {
    const message: string = err instanceof Error ? err.message : String(err);
    turn.deps.notifyError(`Could not save a version. ${message}`);
  }
  return turnAnnouncement(result, agentName(turn.agent));
}
