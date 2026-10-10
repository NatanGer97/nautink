import { CLAUDE_MODEL_OPTIONS, modelsResponseSchema } from '@nautink/contracts/models';
import { API_ROUTES } from '@nautink/contracts/routes';
import { useEffect } from 'react';
import { create } from 'zustand';

import { useUiStore } from '../state/ui-store.ts';

import type { AgentId } from '@nautink/contracts/agents';
import type { ModelOption, ModelsResponse } from '@nautink/contracts/models';
import type { StoreApi, UseBoundStore } from 'zustand';

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** Asks the local server for each agent's models. Throws when the answer is unusable. */
export async function fetchModels(fetchImpl: FetchLike = fetch): Promise<ModelsResponse> {
  const response: Response = await fetchImpl(API_ROUTES.models, {
    headers: { accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`The server answered ${String(response.status)} for ${API_ROUTES.models}.`);
  }
  return modelsResponseSchema.parse(await response.json());
}

interface ModelsState {
  /** The installed Codex CLI's models; `null` until loaded. */
  codex: ModelOption[] | null;
  isLoading: boolean;
}

const INITIAL_MODELS: ModelsState = { codex: null, isLoading: false };

const useModelsStore: UseBoundStore<StoreApi<ModelsState>> = create<ModelsState>()(() => ({
  ...INITIAL_MODELS,
}));

/** Loads the Codex models once a session. A failure leaves only "Default" and retries next time. */
async function loadCodexModels(): Promise<void> {
  const state: ModelsState = useModelsStore.getState();
  if (state.codex !== null || state.isLoading) {
    return;
  }
  useModelsStore.setState({ isLoading: true });
  try {
    useModelsStore.setState({ codex: (await fetchModels()).codex });
  } catch {
    // The server is down or old: the picker offers "Default" only, as Settings shows why.
  } finally {
    useModelsStore.setState({ isLoading: false });
  }
}

/** A remembered model the agent's list no longer has goes back to "Default". */
function forgetMissingModel(agent: AgentId, options: readonly ModelOption[]): void {
  const ui: ReturnType<typeof useUiStore.getState> = useUiStore.getState();
  const model: string | null = ui.defaultModel;
  const isMissing: boolean = model !== null && !options.some((option) => option.id === model);
  if (ui.agent === agent && isMissing) {
    ui.setDefaultModel(null);
  }
}

/** The models `agent` can use besides "Default": Claude's are fixed, Codex's come from the server. */
export function useModelOptions(agent: AgentId): readonly ModelOption[] {
  const codex: ModelOption[] | null = useModelsStore((state) => state.codex);
  useEffect(() => {
    if (agent === 'codex' && codex === null) {
      void loadCodexModels();
    }
    if (agent === 'codex' && codex !== null) {
      forgetMissingModel(agent, codex);
    }
  }, [agent, codex]);
  return agent === 'claude' ? CLAUDE_MODEL_OPTIONS : (codex ?? []);
}

/** The picker value for "the agent CLI's own default model". */
export const DEFAULT_MODEL_VALUE: string = 'default';

/** A picker value back to a model: `null` for "Default". Throws on a value `options` lacks. */
export function toModel(value: string, options: readonly ModelOption[]): string | null {
  if (value === DEFAULT_MODEL_VALUE) {
    return null;
  }
  if (!options.some((option) => option.id === value)) {
    throw new Error(`Unknown model "${value}".`);
  }
  return value;
}

/** "Default", the model's name in `options`, or its id when the list does not have it. */
export function modelLabel(model: string | null, options: readonly ModelOption[]): string {
  if (model === null) {
    return 'Default';
  }
  return options.find((option) => option.id === model)?.label ?? model;
}

/** The chosen model's name for status lines: "Default model" or the agent's name for it. */
export function useChosenModelLabel(): string {
  const agent: AgentId = useUiStore((state) => state.agent);
  const model: string | null = useUiStore((state) => state.defaultModel);
  const options: readonly ModelOption[] = useModelOptions(agent);
  return model === null ? 'Default model' : modelLabel(model, options);
}

/** Forgets the loaded models. For tests. */
export function resetModelsState(): void {
  useModelsStore.setState(INITIAL_MODELS);
}
