import { loadMermaid } from './mermaid-instance.ts';
import { enqueueMermaid } from './mermaid-queue.ts';

import type { Mermaid } from 'mermaid';

/** A parse error, with the 1-based line Mermaid blames when it names one. */
export interface MermaidError {
  message: string;
  line: number | null;
}

interface ParserFailure {
  message?: unknown;
  // Mermaid's parser names the field `first_line`.
  hash?: { loc?: Readonly<Record<string, unknown>> };
}

function lineFrom(failure: ParserFailure, message: string): number | null {
  const fromHash: unknown = failure.hash?.loc?.first_line;
  if (typeof fromHash === 'number' && Number.isFinite(fromHash)) {
    return fromHash;
  }
  const fromText: string | undefined = /line (\d+)/i.exec(message)?.[1];
  return fromText === undefined ? null : Number(fromText);
}

/** Turns whatever `mermaid.parse` threw into a message and a line. */
export function toMermaidError(err: unknown): MermaidError {
  const failure: ParserFailure = typeof err === 'object' && err !== null ? err : {};
  const raw: unknown = failure.message ?? err;
  const message: string = (typeof raw === 'string' ? raw : String(raw)).trim();
  return { message, line: lineFrom(failure, message) };
}

/** `null` when the code parses, otherwise the error. Runs through the shared Mermaid queue. */
export async function validateMermaid(code: string): Promise<MermaidError | null> {
  try {
    const mermaid: Mermaid = await loadMermaid();
    await enqueueMermaid(async () => mermaid.parse(code));
    return null;
  } catch (err) {
    return toMermaidError(err);
  }
}
