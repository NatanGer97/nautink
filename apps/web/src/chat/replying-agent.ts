import { agentName } from './agent-name.ts';
import { useChatStore } from './chat-store.ts';
import { useUiStore } from '../state/ui-store.ts';

/** The name of the agent writing the streaming reply, else the chosen agent's. */
export function useReplyingAgentName(): string {
  const busyAgent: ReturnType<typeof useChatStore.getState>['busyAgent'] = useChatStore(
    (state) => state.busyAgent,
  );
  const chosen: ReturnType<typeof useUiStore.getState>['agent'] = useUiStore(
    (state) => state.agent,
  );
  return agentName(busyAgent ?? chosen);
}
