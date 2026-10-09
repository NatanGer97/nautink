import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { createCommandRegistry } from './command-registry.ts';
import { useCommands, useRegisterCommands } from './use-commands.ts';

import type { AppCommand } from './command-registry.ts';

const command = (id: string, title = `Run ${id}`): AppCommand => ({
  id,
  title,
  group: 'Test',
  run: vi.fn(),
});

describe('createCommandRegistry', () => {
  it('lists registered commands and removes them again', () => {
    const registry = createCommandRegistry();
    const listener = vi.fn();
    registry.subscribe(listener);
    const unregister = registry.register([command('a'), command('b')]);
    expect(registry.getCommands().map((c) => c.id)).toEqual(['a', 'b']);
    unregister();
    expect(registry.getCommands()).toEqual([]);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('keeps the snapshot stable between changes', () => {
    const registry = createCommandRegistry();
    registry.register([command('a')]);
    expect(registry.getCommands()).toBe(registry.getCommands());
  });

  it('throws on a duplicate id or title', () => {
    const registry = createCommandRegistry();
    registry.register([command('a')]);
    expect(() => registry.register([command('a', 'Other')])).toThrow('id "a"');
    expect(() => registry.register([command('b', 'Run a')])).toThrow('title "Run a"');
    expect(() => registry.register([command('c'), command('c')])).toThrow('id "c"');
  });

  it('stops notifying after unsubscribe', () => {
    const registry = createCommandRegistry();
    const listener = vi.fn();
    const unsubscribe = registry.subscribe(listener);
    unsubscribe();
    registry.register([command('a')]);
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('command hooks', () => {
  it('registers while mounted and re-renders subscribers', () => {
    const registry = createCommandRegistry();
    const commands = [command('a')];
    const listed = renderHook(() => useCommands(registry));
    const registered = renderHook(() => {
      useRegisterCommands(commands, registry);
    });
    expect(listed.result.current.map((c) => c.id)).toEqual(['a']);
    act(() => {
      registered.unmount();
    });
    expect(listed.result.current).toEqual([]);
  });
});
