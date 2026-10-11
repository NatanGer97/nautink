import { describe, expect, it } from 'vitest';

import { parseCodexModels } from './codex-models.ts';

describe('parseCodexModels', () => {
  it('keeps the listed models in catalog order', () => {
    const catalog = {
      models: [
        { slug: 'gpt-6-astra', display_name: 'GPT-6-Astra', visibility: 'list', priority: 2 },
        { slug: 'gpt-reserve', display_name: 'GPT-Reserve', visibility: 'hide' },
        { slug: 'gpt-5.6-luna', display_name: 'GPT-5.6-Luna', visibility: 'list' },
      ],
    };
    expect(parseCodexModels(JSON.stringify(catalog))).toEqual([
      { id: 'gpt-6-astra', label: 'GPT-6-Astra' },
      { id: 'gpt-5.6-luna', label: 'GPT-5.6-Luna' },
    ]);
  });

  it('drops a listed model whose slug is not a valid Codex model', () => {
    const catalog = { models: [{ slug: 'Bad Slug', display_name: 'Bad', visibility: 'list' }] };
    expect(parseCodexModels(JSON.stringify(catalog))).toEqual([]);
  });

  it('throws on output that is not JSON', () => {
    expect(() => parseCodexModels('oops')).toThrow('`codex debug models` did not print JSON');
  });

  it('throws on a catalog of an unknown shape', () => {
    expect(() => parseCodexModels('{"models":"nope"}')).toThrow(
      '`codex debug models` printed an unknown catalog shape',
    );
  });
});
