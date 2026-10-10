import { clip } from '../workspace/text.ts';

import type { ReplyStatus } from './chat-reply.ts';
import type { MermaidError } from '../mermaid/validate.ts';

/** Automatic retries after a reply whose diagram does not parse (v1's `MAX_AUTO_FIX`). */
export const MAX_AUTO_FIX: number = 2;

/** How long a prompt may be in an edit step's label (v1's `clip(text, 48)`). */
export const LABEL_PROMPT_LENGTH: number = 48;

/**
 * Why a message is sent: the user typed it, the user asked Claude to fix a parse error, or the app
 * retries on its own after a reply did not parse.
 */
export type SendKind = 'user' | 'fix' | 'auto';

/** v1's prompt for a parse error. */
export function fixPrompt(message: string): string {
  return `The diagram fails to parse:\n${message}\nFix it.`;
}

/** The edit step's label for a turn, as v1 words it, by agent name. `prompt` may be a chip's label. */
export function turnLabel(kind: SendKind, prompt: string, name: string): string {
  if (kind === 'fix') {
    return `${name}: Fix syntax error`;
  }
  if (kind === 'auto') {
    return `${name}: Auto-fix syntax error`;
  }
  return `${name}: ${clip(prompt, LABEL_PROMPT_LENGTH)}`;
}

/** What one attempt of a turn produced. */
export interface AttemptResult {
  status: ReplyStatus;
  /** The diagram of the reply, `null` when it had none. */
  code: string | null;
  /** Its parse error, `null` when it parses or there is no diagram. */
  error: MermaidError | null;
  /** Retries already sent in this turn. */
  retries: number;
}

/** The prompt of the next automatic retry, or `null` when the turn is over. */
export function nextAutoFix(result: AttemptResult): string | null {
  const isFixable: boolean =
    result.status === 'done' && result.code !== null && result.error !== null;
  if (!isFixable || result.error === null || result.retries >= MAX_AUTO_FIX) {
    return null;
  }
  return fixPrompt(result.error.message);
}
