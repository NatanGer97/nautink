import type { MermaidError } from '../mermaid/validate.ts';

/** The window event the chat listens for; the code drawer does not import chat code. */
export const ASK_CLAUDE_TO_FIX_EVENT: string = 'nautink:ask-claude-to-fix';

/** What the event carries: the parse error's message and line (null when Mermaid names none). */
export interface AskClaudeToFixDetail {
  message: string;
  line: number | null;
}

/** Asks the chat to have Claude fix this parse error. */
export function askClaudeToFix(error: MermaidError): void {
  const detail: AskClaudeToFixDetail = { message: error.message, line: error.line };
  window.dispatchEvent(new CustomEvent<AskClaudeToFixDetail>(ASK_CLAUDE_TO_FIX_EVENT, { detail }));
}
