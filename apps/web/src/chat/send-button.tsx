import { IconButton } from '@nautink/ui/icon-button';
import { ArrowUp, Square } from 'lucide-react';

import { stopChat } from './send-chat.ts';
import { SHORTCUTS, shortcutLabel } from '../lib/shortcuts.ts';

import type { ReactElement } from 'react';

/** Ink fill: primary actions never use the accent (PRD §6.1). */
const INK_BUTTON_CLASS: string =
  'rounded-track bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground';

export interface SendButtonProps {
  /** Claude is replying in this diagram, so the button stops it. */
  isStreaming: boolean;
  isDisabled: boolean;
  onSend: () => void;
}

/** Send, or Stop while this diagram's reply streams. */
export function SendButton({ isStreaming, isDisabled, onSend }: SendButtonProps): ReactElement {
  if (isStreaming) {
    return (
      <IconButton
        label="Stop"
        icon={<Square className="size-3.5 fill-current" />}
        className={INK_BUTTON_CLASS}
        onClick={stopChat}
      />
    );
  }
  return (
    <IconButton
      label="Send"
      shortcut={shortcutLabel(SHORTCUTS.send)}
      icon={<ArrowUp className="stroke-2" />}
      isDisabled={isDisabled}
      className={INK_BUTTON_CLASS}
      onClick={onSend}
    />
  );
}
