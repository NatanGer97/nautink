import { useEffect } from 'react';

import { acceptProposal, rejectProposal } from './review-actions.ts';
import { useReviewStore } from './review-store.ts';

/** Where Enter and Esc belong to the focused control, never to the review. */
const OWN_KEYS_SELECTOR: string = [
  'input',
  'textarea',
  'select',
  'button',
  'a[href]',
  '[contenteditable]:not([contenteditable="false"])',
  '[role="textbox"]',
  '[role="combobox"]',
  '[role="button"]',
  '[role="menu"]',
  '[role="menuitem"]',
  '[role="listbox"]',
  '[role="option"]',
  '[role="dialog"]',
  '[role="alertdialog"]',
  '.monaco-editor',
].join(', ');

/** True when the focused element uses Enter or Esc itself (a field, a button, a menu, Monaco). */
export function hasOwnKeys(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(OWN_KEYS_SELECTOR) !== null;
}

/** What a key does to an open proposal, if anything. */
export function reviewKeyAction(event: KeyboardEvent): 'accept' | 'reject' | null {
  const hasModifier: boolean = event.metaKey || event.ctrlKey || event.altKey || event.shiftKey;
  if (event.defaultPrevented || event.isComposing || hasModifier || hasOwnKeys(event.target)) {
    return null;
  }
  if (event.key === 'Enter') {
    return 'accept';
  }
  return event.key === 'Escape' ? 'reject' : null;
}

/** The keydown listener for one diagram's proposal. */
function reviewKeyListener(diagramId: string): (event: KeyboardEvent) => void {
  return (event: KeyboardEvent): void => {
    const action: 'accept' | 'reject' | null = reviewKeyAction(event);
    if (action !== null) {
      event.preventDefault();
    }
    if (action === 'accept') {
      void acceptProposal(diagramId);
    } else if (action === 'reject') {
      rejectProposal(diagramId);
    }
  };
}

/**
 * Enter accepts and Esc rejects the open diagram's proposal (PRD §4.2), unless the focus is in a
 * text field or on a control. Capture phase, so focus mode's Esc does not also run.
 */
export function useReviewKeys(diagramId: string | undefined): void {
  const isOpen: boolean = useReviewStore(
    (state) => diagramId !== undefined && diagramId in state.open,
  );
  useEffect(() => {
    if (!isOpen || diagramId === undefined) {
      return undefined;
    }
    const onKeyDown: (event: KeyboardEvent) => void = reviewKeyListener(diagramId);
    window.addEventListener('keydown', onKeyDown, true);
    return (): void => {
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [isOpen, diagramId]);
}
