import { describe, expect, it } from 'vitest';

import { CLAUDE_MODEL_OPTIONS, codexModelSchema, modelsResponseSchema } from './models.ts';

describe('codexModelSchema', () => {
  it('accepts a model slug', () => {
    expect(codexModelSchema.parse('gpt-6-astra')).toBe('gpt-6-astra');
    expect(codexModelSchema.parse('gpt-5.6-sol')).toBe('gpt-5.6-sol');
  });

  it.each(['', 'a b', 'GPT', '-gpt'])('rejects %j', (model: string) => {
    expect(codexModelSchema.safeParse(model).success).toBe(false);
  });

  it('rejects a Claude model', () => {
    const result = codexModelSchema.safeParse('opus');
    expect(result.error?.issues[0]?.message).toBe('"opus" is a Claude model, not a Codex one');
  });
});

describe('model options', () => {
  it('offers the fixed Claude models', () => {
    expect(CLAUDE_MODEL_OPTIONS).toEqual([
      { id: 'opus', label: 'Opus' },
      { id: 'sonnet', label: 'Sonnet' },
      { id: 'haiku', label: 'Haiku' },
    ]);
  });

  it('parses the models response', () => {
    const response = { claude: CLAUDE_MODEL_OPTIONS, codex: [] };
    expect(modelsResponseSchema.parse(response)).toEqual(response);
  });

  it('rejects an option without a label', () => {
    expect(modelsResponseSchema.safeParse({ claude: [{ id: 'opus' }], codex: [] }).success).toBe(
      false,
    );
  });
});
