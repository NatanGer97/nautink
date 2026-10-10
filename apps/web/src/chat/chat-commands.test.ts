import { describe, expect, it, vi } from 'vitest';

import { buildChatCommands } from './chat-commands.ts';

describe('buildChatCommands', () => {
  it("offers a model command for each of the agent's models, plus the default", () => {
    const setModel = vi.fn();
    const commands = buildChatCommands({
      isBusy: false,
      fixError: null,
      model: 'gpt-6-astra',
      models: [{ id: 'gpt-6-astra', label: 'GPT-6-Astra' }],
      setModel,
    });
    const models = commands.filter((command) => command.group === 'Model');
    expect(models.map((command) => [command.title, command.isDisabled])).toEqual([
      ['Switch to the default model', false],
      ['Switch to GPT-6-Astra', true],
    ]);
    models[0]?.run();
    expect(setModel).toHaveBeenCalledWith(null);
  });
});
