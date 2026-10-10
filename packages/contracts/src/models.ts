import { z } from 'zod';

import type { AgentId } from './agents.ts';

/** The Claude models the user can pick. `null` in a request means the CLI's own default. */
export const MODEL_IDS: readonly ['opus', 'sonnet', 'haiku'] = ['opus', 'sonnet', 'haiku'];

export type ModelId = (typeof MODEL_IDS)[number];

export const modelIdSchema: z.ZodType<ModelId> = z.enum(MODEL_IDS);

export const MODEL_LABELS: Readonly<Record<ModelId, string>> = {
  opus: 'Opus',
  sonnet: 'Sonnet',
  haiku: 'Haiku',
};

/** One entry of a model picker. */
export interface ModelOption {
  id: string;
  label: string;
}

export const CLAUDE_MODEL_OPTIONS: readonly ModelOption[] = MODEL_IDS.map((id: ModelId) => ({
  id,
  label: MODEL_LABELS[id],
}));

function isClaudeModel(model: string): boolean {
  return MODEL_IDS.some((id: ModelId) => id === model);
}

/**
 * A Codex model slug such as `gpt-6-astra`. The list comes from the installed CLI (`GET
 * /api/models`), so only the shape is checked here.
 */
export const codexModelSchema: z.ZodType<string> = z
  .string()
  .regex(/^[a-z0-9][a-z0-9._-]*$/, 'a Codex model is a lowercase slug such as "gpt-6-astra"')
  .refine((model: string) => !isClaudeModel(model), {
    error: (issue) => `${JSON.stringify(issue.input)} is a Claude model, not a Codex one`,
  });

const modelOptionSchema: z.ZodType<ModelOption> = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
});

/** `GET /api/models`: each agent's models, without "Default" (the CLI's own choice). */
export type ModelsResponse = Record<AgentId, ModelOption[]>;

export const modelsResponseSchema: z.ZodType<ModelsResponse> = z.object({
  claude: z.array(modelOptionSchema),
  codex: z.array(modelOptionSchema),
});
