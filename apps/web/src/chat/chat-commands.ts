import { requestNewChat } from './new-chat-button.tsx';
import { askClaudeToFix, stopChat } from './send-chat.ts';

import type { AppCommand } from '../commands/command-registry.ts';
import type { MermaidError } from '../mermaid/validate.ts';
import type { ModelOption } from '@nautink/contracts/models';

/** What the chat commands depend on; they are registered again when it changes. */
export interface ChatCommandState {
  isBusy: boolean;
  /** The open diagram's parse error, checked when the palette opens; `null` when it parses. */
  fixError: MermaidError | null;
  model: string | null;
  /** The chosen agent's name: "Stop Codex". */
  agentName: string;
  /** The current agent's models, besides its default. */
  models: readonly ModelOption[];
  setModel: (model: string | null) => void;
}

function fixCommand(state: ChatCommandState): AppCommand {
  const { fixError } = state;
  return {
    id: 'chat.fix',
    group: 'Chat',
    title: `Ask ${state.agentName} to fix the syntax error`,
    keywords: ['parse', 'error', 'repair'],
    isDisabled: fixError === null || state.isBusy,
    run: (): void => {
      if (fixError !== null) {
        void askClaudeToFix(fixError.message);
      }
    },
  };
}

function conversationCommands(state: ChatCommandState): AppCommand[] {
  return [
    { id: 'chat.new', group: 'Chat', title: 'Start a new chat', run: requestNewChat },
    {
      id: 'chat.stop',
      group: 'Chat',
      title: `Stop ${state.agentName}`,
      isDisabled: !state.isBusy,
      run: stopChat,
    },
    fixCommand(state),
  ];
}

function modelCommands(state: ChatCommandState): AppCommand[] {
  const choices: { model: string | null; name: string }[] = [
    { model: null, name: 'the default model' },
    ...state.models.map((option) => ({ model: option.id, name: option.label })),
  ];
  return choices.map(({ model, name }) => ({
    id: `model.${model ?? 'default'}`,
    group: 'Model',
    title: `Switch to ${name}`,
    isDisabled: state.model === model,
    run: (): void => {
      state.setModel(model);
    },
  }));
}

/** The chat's ⌘K commands: new chat, stop, ask to fix, and the model (v1's palette). */
export function buildChatCommands(state: ChatCommandState): AppCommand[] {
  return [...conversationCommands(state), ...modelCommands(state)];
}
