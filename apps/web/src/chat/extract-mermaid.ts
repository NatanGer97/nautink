// Ported from v1's `src/api.js`: Claude answers with prose plus one or more ```mermaid blocks, and
// the last block is the diagram. While the reply streams, the last block may still be open.

/** A ```mermaid fence up to its closing fence, or up to the end of the text while it is open. */
const FENCE_RE: RegExp = /```mermaid[^\n]*\n([\s\S]*?)(```|$)/g;

const CLOSING_FENCE: string = '```';

export interface ExtractOptions {
  /** Accept a fence that is not closed yet (the reply is still streaming). */
  isPartial?: boolean;
}

/** The code of the last ```mermaid block, without its trailing newline, or `null` when there is none. */
export function extractMermaid(
  text: string,
  { isPartial = false }: ExtractOptions = {},
): string | null {
  let found: string | null = null;
  for (const match of text.matchAll(FENCE_RE)) {
    const isClosed: boolean = match[2] === CLOSING_FENCE;
    if (isClosed || isPartial) {
      found = (match[1] ?? '').replace(/\n$/, '');
    }
  }
  return found;
}

/** The reply's prose: every ```mermaid block removed, trimmed. */
export function stripMermaid(text: string): string {
  return text.replace(FENCE_RE, '').trim();
}

/** True when the reply has started a ```mermaid block. */
export function hasMermaidFence(text: string): boolean {
  return text.includes('```mermaid');
}
