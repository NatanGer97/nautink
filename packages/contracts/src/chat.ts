import { z } from 'zod';

import { modelIdSchema } from './models.ts';

import type { ModelId } from './models.ts';

/** Nodes the user selected on the canvas; Claude limits its change to them (PRD §4.1). */
export interface ChatSelection {
  ids: string[];
  labels: string[];
}

/** Body of `POST /api/chat`. */
export interface ChatRequest {
  message: string;
  code: string;
  sessionId: string | null;
  model: ModelId | null;
  selection: ChatSelection | null;
}

const selectionSchema: z.ZodType<ChatSelection> = z.object({
  ids: z.array(z.string().min(1)).min(1),
  labels: z.array(z.string()),
});

export const chatRequestSchema: z.ZodType<ChatRequest> = z.object({
  message: z.string().trim().min(1, 'message is required'),
  code: z.string(),
  sessionId: z.string().min(1).nullable(),
  model: modelIdSchema.nullable(),
  selection: selectionSchema.nullable(),
});

/** One event in the `POST /api/chat` SSE stream. `type` is the SSE event name. */
export type ChatEvent =
  | { type: 'session'; sessionId: string; model: string }
  | { type: 'delta'; text: string }
  | { type: 'turn' }
  | { type: 'tool'; label: string }
  | {
      type: 'done';
      sessionId: string;
      text: string;
      isError: boolean;
      durationMs: number;
      costUsd: number;
    }
  | { type: 'error'; message: string };

export type ChatEventType = ChatEvent['type'];

export const chatEventSchema: z.ZodType<ChatEvent> = z.discriminatedUnion('type', [
  z.object({ type: z.literal('session'), sessionId: z.string(), model: z.string() }),
  z.object({ type: z.literal('delta'), text: z.string() }),
  z.object({ type: z.literal('turn') }),
  z.object({ type: z.literal('tool'), label: z.string() }),
  z.object({
    type: z.literal('done'),
    sessionId: z.string(),
    text: z.string(),
    isError: z.boolean(),
    durationMs: z.number().nonnegative(),
    costUsd: z.number().nonnegative(),
  }),
  z.object({ type: z.literal('error'), message: z.string() }),
]);
