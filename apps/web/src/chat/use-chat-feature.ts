import { useEffect, useMemo, useState } from 'react';
import { z } from 'zod';

import { useAgentName } from './agent-name.ts';
import { buildChatCommands } from './chat-commands.ts';
import { useChatStore } from './chat-store.ts';
import { askClaudeToFix } from './send-chat.ts';
import { useRegisterCommands } from '../commands/use-commands.ts';
import { validateMermaid } from '../mermaid/validate.ts';
import { useModelOptions } from '../settings/models.ts';
import { useUiStore } from '../state/ui-store.ts';
import { selectActiveDiagram, useWorkspaceStore } from '../workspace/use-workspace.ts';

import type { AppCommand } from '../commands/command-registry.ts';
import type { MermaidError } from '../mermaid/validate.ts';
import type { ModelOption } from '@nautink/contracts/models';

/** Fired on `window` by the code drawer's "Ask Claude to fix" (`detail: { message, line }`). */
export const ASK_CLAUDE_TO_FIX_EVENT: string = 'nautink:ask-claude-to-fix';

/** `detail` of `ASK_CLAUDE_TO_FIX_EVENT`. */
export interface AskClaudeToFixDetail {
  message: string;
  line: number | null;
}

const fixDetailSchema: z.ZodType<AskClaudeToFixDetail> = z.object({
  message: z.string().min(1),
  line: z.number().int().nullable(),
});

/** Sends the parse error to Claude when another part of the app asks for it. */
function useAskClaudeToFixListener(): void {
  useEffect(() => {
    const onAsk = (event: Event): void => {
      const detail: unknown = event instanceof CustomEvent ? event.detail : undefined;
      void askClaudeToFix(fixDetailSchema.parse(detail).message);
    };
    window.addEventListener(ASK_CLAUDE_TO_FIX_EVENT, onAsk);
    return (): void => {
      window.removeEventListener(ASK_CLAUDE_TO_FIX_EVENT, onAsk);
    };
  }, []);
}

/** Parses `code` and hands the result over unless the caller moved on (`run.isCurrent`). */
async function checkCode(
  code: string,
  run: { isCurrent: boolean },
  onResult: (error: MermaidError | null) => void,
): Promise<void> {
  const result: MermaidError | null = await validateMermaid(code);
  if (run.isCurrent) {
    onResult(result);
  }
}

/** The open diagram's parse error, checked each time the palette opens (not on every keystroke). */
function usePaletteParseError(): MermaidError | null {
  const isPaletteOpen: boolean = useUiStore((state) => state.isPaletteOpen);
  const [error, setError] = useState<MermaidError | null>(null);
  useEffect(() => {
    const code: string = selectActiveDiagram(useWorkspaceStore.getState())?.code ?? '';
    if (!isPaletteOpen || code.trim() === '') {
      return undefined;
    }
    const run: { isCurrent: boolean } = { isCurrent: true };
    void checkCode(code, run, setError);
    return (): void => {
      run.isCurrent = false;
    };
  }, [isPaletteOpen]);
  return error;
}

function useChatCommands(): void {
  const isBusy: boolean = useChatStore((state) => state.busyDiagramId !== null);
  const model: string | null = useUiStore((state) => state.defaultModel);
  const models: readonly ModelOption[] = useModelOptions(useUiStore((state) => state.agent));
  const name: string = useAgentName();
  const fixError: MermaidError | null = usePaletteParseError();
  const commands: AppCommand[] = useMemo(
    () =>
      buildChatCommands({
        isBusy,
        fixError,
        model,
        models,
        agentName: name,
        setModel: useUiStore.getState().setDefaultModel,
      }),
    [isBusy, fixError, model, models, name],
  );
  useRegisterCommands(commands);
}

/** The chat's app-wide parts: its ⌘K commands and the "Ask Claude to fix" listener. */
export function useChatFeature(): void {
  useAskClaudeToFixListener();
  useChatCommands();
}
