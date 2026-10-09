import { z } from 'zod';

/** The Claude models the user can pick. `null` in a request means the CLI's own default. */
export const MODEL_IDS: readonly ['opus', 'sonnet', 'haiku'] = ['opus', 'sonnet', 'haiku'];

export type ModelId = (typeof MODEL_IDS)[number];

export const modelIdSchema: z.ZodType<ModelId> = z.enum(MODEL_IDS);

export const MODEL_LABELS: Readonly<Record<ModelId, string>> = {
  opus: 'Opus',
  sonnet: 'Sonnet',
  haiku: 'Haiku',
};
