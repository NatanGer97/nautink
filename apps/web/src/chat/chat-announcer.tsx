import { useChatStore } from './chat-store.ts';

import type { ReactElement } from 'react';

/** A polite live region that says when Claude starts and finishes a reply, wherever focus is. */
export function ChatAnnouncer(): ReactElement {
  const announcement: string = useChatStore((state) => state.announcement);
  return (
    <div role="status" aria-live="polite" className="sr-only" data-slot="chat-announcer">
      {announcement}
    </div>
  );
}
