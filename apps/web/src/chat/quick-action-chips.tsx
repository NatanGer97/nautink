import { cn } from '@nautink/ui/lib/utils';

import { useAgentName } from './agent-name.ts';
import { chatSelectionFor } from './chat-selection.ts';
import { useChatStore } from './chat-store.ts';
import { ChipButton } from './chip-button.tsx';
import { quickActionsFor } from './quick-actions.ts';
import { sendChat } from './send-chat.ts';

import type { QuickAction } from './quick-actions.ts';
import type { ReactElement } from 'react';

export interface QuickActionChipsProps {
  /** The diagram the chips act on: its selection goes along while the chip shows. */
  diagramId: string;
  /** Its code; the type picks the extra chips. */
  code: string;
  className?: string;
}

/**
 * v1's quick actions for this diagram's type, as chips that send their prompt (M1), with the canvas
 * selection while the selection chip shows, as the composer does (PRD §4.1).
 */
export function QuickActionChips({
  diagramId,
  code,
  className,
}: QuickActionChipsProps): ReactElement | null {
  const isBusy: boolean = useChatStore((state) => state.busyDiagramId !== null);
  const name: string = useAgentName();
  const actions: readonly QuickAction[] = quickActionsFor(code);
  if (actions.length === 0) {
    return null;
  }
  return (
    <div
      role="group"
      aria-label="Quick actions"
      className={cn('flex flex-wrap gap-1.5', className)}
    >
      {actions.map((action) => (
        <ChipButton
          key={action.label}
          hint={action.prompt}
          {...(isBusy ? { disabledReason: `${name} is replying.` } : {})}
          onClick={() =>
            void sendChat(action.prompt, {
              title: action.label,
              selection: chatSelectionFor(diagramId),
            })
          }
        >
          {action.label}
        </ChipButton>
      ))}
    </div>
  );
}
