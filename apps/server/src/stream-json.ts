import { z } from 'zod';

import type { ChatEvent } from '@nautink/contracts/chat';

// Only the fields the bridge reads from the CLI's `--output-format stream-json` lines, renamed to
// camelCase as they are parsed.
interface InitMessage {
  sessionId: string;
  model: string;
}

interface StreamEventMessage {
  isTopLevel: boolean;
  eventType: string;
  deltaType: string | null;
  text: string;
}

/** A `tool_use` content block of an assistant message. */
export interface ToolUse {
  name: string;
  input: Record<string, unknown>;
}

interface AssistantMessage {
  content: unknown[];
}

interface ResultMessage {
  sessionId: string;
  text: string;
  isError: boolean;
  durationMs: number;
  costUsd: number;
}

const initSchema: z.ZodType<InitMessage> = z
  .object({
    type: z.literal('system'),
    subtype: z.literal('init'),
    session_id: z.string(),
    model: z.string(),
  })
  .transform((message) => ({ sessionId: message.session_id, model: message.model }));

const streamEventSchema: z.ZodType<StreamEventMessage> = z
  .object({
    type: z.literal('stream_event'),
    parent_tool_use_id: z.string().nullish(),
    event: z.object({
      type: z.string(),
      delta: z.object({ type: z.string(), text: z.string().optional() }).optional(),
    }),
  })
  .transform((message) => ({
    // Text from a sub-agent's message is not part of the reply.
    isTopLevel: message.parent_tool_use_id === null || message.parent_tool_use_id === undefined,
    eventType: message.event.type,
    deltaType: message.event.delta?.type ?? null,
    text: message.event.delta?.text ?? '',
  }));

const toolUseSchema: z.ZodType<ToolUse> = z.object({
  type: z.literal('tool_use'),
  name: z.string(),
  input: z.record(z.string(), z.unknown()).default({}),
});

const assistantSchema: z.ZodType<AssistantMessage> = z
  .object({ type: z.literal('assistant'), message: z.object({ content: z.array(z.unknown()) }) })
  .transform((message) => ({ content: message.message.content }));

const resultSchema: z.ZodType<ResultMessage> = z
  .object({
    type: z.literal('result'),
    session_id: z.string(),
    result: z.string().default(''),
    is_error: z.boolean().default(false),
    duration_ms: z.number().nonnegative().default(0),
    total_cost_usd: z.number().nonnegative().default(0),
  })
  .transform((message) => ({
    sessionId: message.session_id,
    text: message.result,
    isError: message.is_error,
    durationMs: message.duration_ms,
    costUsd: message.total_cost_usd,
  }));

const TOOL_TARGET_KEYS: readonly string[] = ['file_path', 'pattern', 'path'];

/** A short label for a tool step, such as `Read src/app.ts` or `Grep auth` (v1's `describeTool`). */
export function describeTool(toolUse: ToolUse): string {
  const target: unknown = TOOL_TARGET_KEYS.map((key: string) => toolUse.input[key]).find(
    (value: unknown) => typeof value === 'string' && value !== '',
  );
  return typeof target === 'string' ? `${toolUse.name} ${target}` : toolUse.name;
}

function fromStreamEvent(message: StreamEventMessage): ChatEvent[] {
  const isReplyText: boolean =
    message.eventType === 'content_block_delta' &&
    message.deltaType === 'text_delta' &&
    message.isTopLevel;
  if (isReplyText) {
    return [{ type: 'delta', text: message.text }];
  }
  // A new assistant message (for example after a tool call) starts a new paragraph in the reply.
  return message.eventType === 'message_start' ? [{ type: 'turn' }] : [];
}

function fromAssistant(message: AssistantMessage): ChatEvent[] {
  return message.content.flatMap((block: unknown): ChatEvent[] => {
    const toolUse: z.ZodSafeParseResult<ToolUse> = toolUseSchema.safeParse(block);
    return toolUse.success ? [{ type: 'tool', label: describeTool(toolUse.data) }] : [];
  });
}

/** Turns one parsed stream-json message into the SSE events it stands for; unknown ones give none. */
export function toChatEvents(message: unknown): ChatEvent[] {
  const init: z.ZodSafeParseResult<InitMessage> = initSchema.safeParse(message);
  if (init.success) {
    return [{ type: 'session', ...init.data }];
  }
  const streamEvent: z.ZodSafeParseResult<StreamEventMessage> =
    streamEventSchema.safeParse(message);
  if (streamEvent.success) {
    return fromStreamEvent(streamEvent.data);
  }
  const assistant: z.ZodSafeParseResult<AssistantMessage> = assistantSchema.safeParse(message);
  if (assistant.success) {
    return fromAssistant(assistant.data);
  }
  const result: z.ZodSafeParseResult<ResultMessage> = resultSchema.safeParse(message);
  return result.success ? [{ type: 'done', ...result.data }] : [];
}

/** Parses one stdout line. Blank and non-JSON lines (CLI noise) give no events, as in v1. */
export function lineToChatEvents(line: string): ChatEvent[] {
  const trimmed: string = line.trim();
  if (trimmed === '') {
    return [];
  }
  let message: unknown;
  try {
    message = JSON.parse(trimmed);
  } catch {
    return [];
  }
  return toChatEvents(message);
}

/** Splits a byte stream into complete lines; a trailing partial line waits for the next chunk. */
export interface LineSplitter {
  push: (chunk: string) => string[];
}

export function createLineSplitter(): LineSplitter {
  let buffer: string = '';
  return {
    push(chunk: string): string[] {
      buffer += chunk;
      const lines: string[] = buffer.split('\n');
      buffer = lines.pop() ?? '';
      return lines;
    },
  };
}
