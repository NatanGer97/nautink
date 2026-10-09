import { canSendChat, sendChat } from './send-chat.ts';
import { useWorkspaceStore } from '../workspace/use-workspace.ts';

/**
 * Sends a diagram's unsent text from the composer or the prompt bar, clearing it first. Returns
 * false, keeping the text, when it cannot be sent now (empty, or Claude is busy).
 */
export function submitDraft(diagramId: string, draft: string): boolean {
  if (!canSendChat(draft)) {
    return false;
  }
  useWorkspaceStore.getState().setDraft(diagramId, '');
  void sendChat(draft);
  return true;
}
