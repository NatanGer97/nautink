import type { KeyboardEvent } from 'react';

/**
 * True when a key press in a message box should send the message: Enter, with or without ⌘.
 * Shift+Enter adds a new line instead, and a key that ends an IME composition never sends.
 */
export function isSendKey(event: KeyboardEvent<HTMLElement>): boolean {
  return event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing;
}
