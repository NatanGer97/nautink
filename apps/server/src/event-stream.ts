import { encodeChatEvent } from '@nautink/contracts/sse';

import type { ChatEvent } from '@nautink/contracts/chat';
import type { Response } from 'express';

/** An open SSE response. Writes after the client has gone away are dropped. */
export interface EventStream {
  send: (event: ChatEvent) => void;
  end: () => void;
}

const OK: number = 200;

const SSE_HEADERS: Readonly<Record<string, string>> = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
};

export function openEventStream(res: Response): EventStream {
  res.writeHead(OK, SSE_HEADERS);
  res.flushHeaders();
  const isOpen = (): boolean => !res.writableEnded && !res.destroyed;
  return {
    send(event: ChatEvent): void {
      if (isOpen()) {
        res.write(encodeChatEvent(event));
      }
    },
    end(): void {
      if (isOpen()) {
        res.end();
      }
    },
  };
}
