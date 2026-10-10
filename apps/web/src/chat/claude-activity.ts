import { useChatStore } from './chat-store.ts';
import { hasMermaidFence } from './extract-mermaid.ts';
import { useWorkspaceStore } from '../workspace/use-workspace.ts';

import type { ChatMessage } from '@nautink/storage/records';

const MS_PER_SECOND: number = 1000;

export const THINKING: string = 'Thinking…';
export const DRAWING: string = 'Drawing the diagram…';
export const WRITING: string = 'Writing a reply…';

/** What Claude is doing in a streaming reply: its newest tool step, drawing, writing or thinking. */
export function activityStep(message: ChatMessage | undefined): string {
  const tools: readonly string[] = message?.tools ?? [];
  const lastTool: string | undefined = tools.at(-1);
  if (lastTool !== undefined) {
    return lastTool;
  }
  const text: string = message?.text ?? '';
  if (hasMermaidFence(text)) {
    return DRAWING;
  }
  return text.trim() === '' ? THINKING : WRITING;
}

/** Whole seconds since `startedAt`, never negative. */
export function elapsedSeconds(startedAt: number, now: number): number {
  return Math.max(0, Math.floor((now - startedAt) / MS_PER_SECOND));
}

export interface ClaudeActivity {
  step: string;
  startedAt: number;
}

/** Claude's reply streaming into `diagramId`, or null while Claude works on nothing there. */
export function useClaudeActivity(diagramId: string | null): ClaudeActivity | null {
  const isBusy: boolean = useChatStore(
    (state) => diagramId !== null && state.busyDiagramId === diagramId,
  );
  const startedAt: number | null = useChatStore((state) => state.startedAt);
  const step: string = useWorkspaceStore((state) => {
    const messages: readonly ChatMessage[] =
      state.diagrams.find((item) => item.id === diagramId)?.messages ?? [];
    return activityStep(messages.at(-1));
  });
  return isBusy && startedAt !== null ? { step, startedAt } : null;
}
