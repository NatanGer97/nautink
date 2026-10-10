import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@nautink/ui/components/alert-dialog';
import { IconButton } from '@nautink/ui/icon-button';
import { Plus } from 'lucide-react';

import { useAgentName } from './agent-name.ts';
import { useChatStore } from './chat-store.ts';
import { startNewChat } from './send-chat.ts';
import { OUTLINE_BUTTON_CLASS } from '../shell/button-styles.ts';
import { useUiStore } from '../state/ui-store.ts';
import { selectActiveDiagram, useWorkspaceStore } from '../workspace/use-workspace.ts';

import type { Diagram } from '@nautink/storage/records';
import type { ReactElement } from 'react';

/** New chat: asks first when there are messages to lose, otherwise starts at once. */
export function requestNewChat(): void {
  const diagram: Diagram | undefined = selectActiveDiagram(useWorkspaceStore.getState());
  if (diagram === undefined) {
    return;
  }
  if (diagram.messages.length === 0) {
    startNewChat(diagram.id);
    return;
  }
  useUiStore.getState().setActivePanel('chat');
  useChatStore.getState().setNewChatConfirmOpen(true);
}

/** The chat header's + button and its confirmation. */
export function NewChatButton(): ReactElement {
  const isOpen: boolean = useChatStore((state) => state.isNewChatConfirmOpen);
  const setOpen: (isOpen: boolean) => void = useChatStore((state) => state.setNewChatConfirmOpen);
  const name: string = useAgentName();
  return (
    <>
      <IconButton label="New chat" icon={<Plus />} onClick={requestNewChat} />
      <AlertDialog open={isOpen} onOpenChange={setOpen}>
        <AlertDialogContent size="sm" className="rounded-[14px] bg-panel">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg">Start a new chat?</AlertDialogTitle>
            <AlertDialogDescription>
              This clears the messages of this diagram and starts a new {name} session. The diagram
              and its versions stay as they are.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel size="sm" className={OUTLINE_BUTTON_CLASS}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              size="sm"
              onClick={() => {
                const diagram: Diagram | undefined = selectActiveDiagram(
                  useWorkspaceStore.getState(),
                );
                if (diagram !== undefined) {
                  startNewChat(diagram.id);
                }
              }}
            >
              Start new chat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
