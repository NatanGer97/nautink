import { z } from 'zod';

import { agentIdSchema } from './agents.ts';
import { codexModelSchema, modelIdSchema } from './models.ts';

import type { AgentId } from './agents.ts';

/**
 * Items the user selected on the canvas; Claude limits its change to them (PRD §4.1). The three
 * lists are parallel: `labels[i]` and `kinds[i]` describe `ids[i]`. `kinds` (`node`, `link`,
 * `class` …) is optional, so clients that send only ids and labels keep working.
 */
export interface ChatSelection {
  ids: string[];
  labels: string[];
  kinds?: string[];
}

/** Body of `POST /api/chat`. */
export interface ChatRequest {
  message: string;
  code: string;
  sessionId: string | null;
  /** Which CLI answers (ADR-002). */
  agent: AgentId;
  /** One of the agent's models, or `null` for the CLI's own default. */
  model: string | null;
  selection: ChatSelection | null;
}

const selectionSchema: z.ZodType<ChatSelection> = z.object({
  ids: z.array(z.string().min(1)).min(1),
  labels: z.array(z.string()),
  kinds: z.array(z.string()).exactOptional(),
});

/**
 * A CLI session id. It goes to the CLI as an argument (`codex exec resume <id>`), so it must not start
 * with `-`: an id like `--dangerously-bypass-approvals-and-sandbox` would be read as a flag.
 */
const sessionIdSchema: z.ZodType<string> = z
  .string()
  .regex(
    /^[A-Za-z0-9][A-Za-z0-9._-]*$/,
    'sessionId must be letters, digits, ".", "_" or "-", not starting with "-"',
  );

const MODEL_SCHEMAS: Readonly<Record<AgentId, z.ZodType<string>>> = {
  claude: modelIdSchema,
  codex: codexModelSchema,
};

/** Whether `model` can be sent to `agent`. `null` (the CLI's default) belongs to every agent. */
export function isModelOfAgent(model: string | null, agent: AgentId): boolean {
  return model === null || MODEL_SCHEMAS[agent].safeParse(model).success;
}

export const chatRequestSchema: z.ZodType<ChatRequest> = z
  .object({
    message: z.string().trim().min(1, 'message is required'),
    code: z.string(),
    sessionId: sessionIdSchema.nullable(),
    // Clients older than ADR-002 send no agent: they mean Claude.
    agent: agentIdSchema.default('claude'),
    model: z.string().min(1).nullable(),
    selection: selectionSchema.nullable(),
  })
  .superRefine((request, context) => {
    if (!isModelOfAgent(request.model, request.agent)) {
      context.addIssue({
        code: 'custom',
        path: ['model'],
        message: `model "${String(request.model)}" does not belong to agent "${request.agent}"`,
      });
    }
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
      /** `null` when the agent reports no cost (Codex). */
      costUsd: number | null;
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
    costUsd: z.number().nonnegative().nullable(),
  }),
  z.object({ type: z.literal('error'), message: z.string() }),
]);
