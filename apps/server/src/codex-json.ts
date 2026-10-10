import { z } from 'zod';

import type { ChatEvent } from '@nautink/contracts/chat';

// Only the `codex exec --json` events the bridge reads (ADR-002). Every other event gives nothing.
type CodexEvent =
  | { kind: 'thread'; threadId: string }
  | { kind: 'message'; text: string }
  | { kind: 'command'; command: string }
  | { kind: 'completed' }
  | { kind: 'failed'; message: string };

const codexEventSchema: z.ZodType<CodexEvent> = z.union([
  z
    .object({ type: z.literal('thread.started'), thread_id: z.string().min(1) })
    .transform((event) => ({ kind: 'thread' as const, threadId: event.thread_id })),
  z
    .object({
      type: z.literal('item.completed'),
      item: z.object({ type: z.literal('agent_message'), text: z.string() }),
    })
    .transform((event) => ({ kind: 'message' as const, text: event.item.text })),
  z
    .object({
      type: z.literal('item.started'),
      item: z.object({ type: z.literal('command_execution'), command: z.string() }),
    })
    .transform((event) => ({ kind: 'command' as const, command: event.item.command })),
  z.object({ type: z.literal('turn.completed') }).transform(() => ({ kind: 'completed' as const })),
  z
    .object({ type: z.literal('turn.failed'), error: z.object({ message: z.string() }) })
    .transform((event) => ({ kind: 'failed' as const, message: event.error.message })),
]);

const MAX_LABEL_LENGTH: number = 80;

/** `/bin/zsh -lc "cat \"a.ts\""` → `cat "a.ts"`: the command inside Codex's login-shell wrapper. */
function unwrapShell(command: string): string {
  const match: RegExpExecArray | null = /^\S+\s+-l?c\s+(["'])([\s\S]*)\1$/.exec(command);
  if (match === null) {
    return command;
  }
  const [, quote = '', inner = ''] = match;
  return quote === '"' ? inner.replaceAll(/\\(["\\$`])/g, '$1') : inner;
}

/** A short label for a shell step, such as `Run rg --files src`. */
export function describeCommand(command: string): string {
  const label: string = `Run ${unwrapShell(command)}`;
  return label.length <= MAX_LABEL_LENGTH ? label : `${label.slice(0, MAX_LABEL_LENGTH - 1)}…`;
}

export interface CodexParserOptions {
  /** The model the run was started with; `null` means Codex's own default. */
  model: string | null;
  now: () => number;
}

export interface CodexParser {
  parseLine: (line: string) => ChatEvent[];
}

function parseJson(line: string): unknown {
  try {
    return JSON.parse(line);
  } catch {
    return undefined;
  }
}

/** What one run has seen so far: Codex reports neither the duration nor the reply on its last event. */
class CodexRun {
  private sessionId: string = '';
  private lastText: string = '';
  private messageCount: number = 0;
  private readonly startedAt: number;
  private readonly options: CodexParserOptions;

  constructor(options: CodexParserOptions) {
    this.options = options;
    this.startedAt = options.now();
  }

  toChatEvents(event: CodexEvent): ChatEvent[] {
    switch (event.kind) {
      case 'thread':
        this.sessionId = event.threadId;
        return [
          { type: 'session', sessionId: event.threadId, model: this.options.model ?? 'default' },
        ];
      case 'message':
        return this.message(event.text);
      case 'command':
        return [{ type: 'tool', label: describeCommand(event.command) }];
      case 'completed':
        return [this.done()];
      case 'failed':
        return [{ type: 'error', message: event.message }];
    }
  }

  private message(text: string): ChatEvent[] {
    this.messageCount += 1;
    this.lastText = text;
    const delta: ChatEvent = { type: 'delta', text };
    // A later message (for example after a shell step) starts a new paragraph, as Claude's turns do.
    return this.messageCount === 1 ? [delta] : [{ type: 'turn' }, delta];
  }

  private done(): ChatEvent {
    return {
      type: 'done',
      sessionId: this.sessionId,
      text: this.lastText,
      isError: false,
      durationMs: Math.max(0, this.options.now() - this.startedAt),
      costUsd: null,
    };
  }
}

/** A parser for one Codex run. Blank, non-JSON and unknown lines give no events. */
export function createCodexParser(options: CodexParserOptions): CodexParser {
  const run: CodexRun = new CodexRun(options);
  return {
    parseLine(line: string): ChatEvent[] {
      const trimmed: string = line.trim();
      const event: z.ZodSafeParseResult<CodexEvent> = codexEventSchema.safeParse(
        trimmed === '' ? undefined : parseJson(trimmed),
      );
      return event.success ? run.toChatEvents(event.data) : [];
    },
  };
}
