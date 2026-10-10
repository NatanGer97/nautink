import { chatSelectionFor } from './chat-selection.ts';
import { canSendChat, sendChat } from './send-chat.ts';
import { useWorkspaceStore } from '../workspace/use-workspace.ts';

/**
 * Sends a diagram's unsent text from the composer or the prompt bar, clearing it first, with the
 * canvas selection while the selection chip shows (PRD §4.1). Returns false, keeping the text, when
 * it cannot be sent now (empty, or Claude is busy).
 */
export function submitDraft(diagramId: string, draft: string): boolean {
  if (!canSendChat(draft)) {
    return false;
  }
  useWorkspaceStore.getState().setDraft(diagramId, '');
  void sendChat(draft, { selection: chatSelectionFor(diagramId) });
  return true;
}
