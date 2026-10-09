import { useUiStore } from '../state/ui-store.ts';

import type { AppCommand } from '../commands/command-registry.ts';

/** "Open the template gallery" in the ⌘K palette. */
export const TEMPLATE_COMMANDS: readonly AppCommand[] = [
  {
    id: 'diagram.new-from-template',
    group: 'Diagram',
    title: 'Open the template gallery',
    keywords: ['templates', 'examples', 'starter'],
    isDeferred: true,
    run: (): void => {
      useUiStore.getState().setTemplatesOpen(true);
    },
  },
];
