import { nextAutoFix, turnLabel } from './auto-fix.ts';
import { streamChat } from './chat-client.ts';
import { applyChatEvent, failReply, settleReply, startReply } from './chat-reply.ts';
import { useChatStore } from './chat-store.ts';
import { extractMermaid } from './extract-mermaid.ts';
import { findTurnDiagram } from './turn-edit.ts';
import { appendExchange, writeReply, writeSession } from './turn-messages.ts';
import { saveTurnVersions } from './turn-versions.ts';

import type { AttemptResult, SendKind } from './auto-fix.ts';
import type { ChatDeps } from './chat-deps.ts';
import type { ChatReply } from './chat-reply.ts';
import type { TurnEdit } from './turn-edit.ts';
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
  selection: ChatSelection | null;
  edit: TurnEdit;
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
    sessionId: diagram?.sessionId ?? null,
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
    reply = settleReply(reply);
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
    turn.deps.notifyError(`Claude could not reply. ${outcome.reply.error ?? ''}`.trim());
  }
}

async function runAttempt(turn: Turn, attempt: Attempt, retries: number): Promise<AttemptResult> {
  const codeBefore: string = findTurnDiagram(turn.workspace(), turn.diagramId)?.code ?? turn.before;
  const messageIndex: number = appendExchange(turn, { text: attempt.message, kind: attempt.kind });
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
    const retry: Attempt = { message: prompt, kind: 'auto', label: turnLabel('auto', prompt) };
    result = await runAttempt(turn, retry, result.retries + 1);
    prompt = nextAutoFix(result);
  }
  return result;
}

/** What the live region says when a turn ends. */
export function turnAnnouncement(result: AttemptResult): string {
  if (result.status === 'stopped') {
    return 'Claude stopped.';
  }
  if (result.status === 'error') {
    return 'Claude could not reply.';
  }
  if (result.code === null) {
    return 'Claude replied.';
  }
  return result.error === null
    ? 'Claude updated the diagram.'
    : 'Claude updated the diagram, but it still has a syntax error.';
}

/** The turn's new code when it ended with a changed diagram that parses, else `null`. */
function savedCode(turn: Turn, result: AttemptResult): string | null {
  const isValid: boolean = result.status === 'done' && result.error === null;
  return isValid && result.code !== turn.before ? result.code : null;
}

/** Saves a version when the turn ends with a changed, valid diagram. Returns the announcement. */
export async function finishTurn(turn: Turn, result: AttemptResult): Promise<string> {
  const after: string | null = savedCode(turn, result);
  try {
    if (after !== null) {
      const { diagramId, before, prompt } = turn;
      await saveTurnVersions({
        db: turn.workspace().requireDb(),
        diagramId,
        before,
        after,
        prompt,
      });
    }
  } catch (err) {
    const message: string = err instanceof Error ? err.message : String(err);
    turn.deps.notifyError(`Could not save a version. ${message}`);
  }
  return turnAnnouncement(result);
}
