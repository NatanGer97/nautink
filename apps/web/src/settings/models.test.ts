import { CLAUDE_MODEL_OPTIONS } from '@nautink/contracts/models';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchModels, modelLabel, resetModelsState, useModelOptions } from './models.ts';
import { useUiStore } from '../state/ui-store.ts';

const CODEX = [
  { id: 'gpt-6-astra', label: 'GPT-6-Astra' },
  { id: 'gpt-5.6-luna', label: 'GPT-5.6-Luna' },
];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function stubModels(codex: unknown): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async () =>
    Promise.resolve(json({ claude: CLAUDE_MODEL_OPTIONS, codex })),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  resetModelsState();
});

describe('fetchModels', () => {
  it('returns the validated models answer', async () => {
    const fetchImpl = vi.fn(async () => Promise.resolve(json({ claude: [], codex: CODEX })));
    await expect(fetchModels(fetchImpl)).resolves.toEqual({ claude: [], codex: CODEX });
    expect(fetchImpl).toHaveBeenCalledWith('/api/models', expect.anything());
  });

  it('throws on an HTTP error or a body that does not match', async () => {
    await expect(fetchModels(async () => Promise.resolve(json({}, 500)))).rejects.toThrow('500');
    await expect(fetchModels(async () => Promise.resolve(json({ codex: 1 })))).rejects.toThrow();
  });
});

describe('useModelOptions', () => {
  it('offers the fixed Claude models without asking the server', () => {
    const fetchMock = stubModels(CODEX);
    const { result } = renderHook(() => useModelOptions('claude'));
    expect(result.current).toEqual(CLAUDE_MODEL_OPTIONS);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('loads the installed Codex models once', async () => {
    const fetchMock = stubModels(CODEX);
    const first = renderHook(() => useModelOptions('codex'));
    expect(first.result.current).toEqual([]);
    await waitFor(() => {
      expect(first.result.current).toEqual(CODEX);
    });
    const second = renderHook(() => useModelOptions('codex'));
    expect(second.result.current).toEqual(CODEX);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('offers no Codex models when the server cannot list them', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))),
    );
    const { result } = renderHook(() => useModelOptions('codex'));
    await act(async () => Promise.resolve());
    expect(result.current).toEqual([]);
  });

  it('resets a remembered Codex model the installed CLI no longer lists', async () => {
    stubModels(CODEX);
    useUiStore.getState().setAgent('codex');
    useUiStore.getState().setDefaultModel('gpt-gone');
    renderHook(() => useModelOptions('codex'));
    await waitFor(() => {
      expect(useUiStore.getState().defaultModel).toBeNull();
    });
  });
});

describe('modelLabel', () => {
  it("names the model by the agent's list, or by its id", () => {
    expect(modelLabel(null, CODEX)).toBe('Default');
    expect(modelLabel('gpt-6-astra', CODEX)).toBe('GPT-6-Astra');
    expect(modelLabel('gpt-unknown', CODEX)).toBe('gpt-unknown');
  });
});
