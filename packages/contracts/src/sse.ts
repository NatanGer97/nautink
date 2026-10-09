import { chatEventSchema } from './chat.ts';

import type { ChatEvent } from './chat.ts';

const FRAME_SEPARATOR: string = '\n\n';

/** One SSE frame: `event: <type>` and the rest of the event as JSON `data`. */
export function encodeChatEvent(event: ChatEvent): string {
  const { type, ...data } = event;
  return `event: ${type}\ndata: ${JSON.stringify(data)}${FRAME_SEPARATOR}`;
}

/** Reads one frame back into a validated event. Throws when the frame is not a known event. */
export function decodeChatFrame(frame: string): ChatEvent {
  let type: string = 'message';
  let data: string = '';
  for (const line of frame.split('\n')) {
    if (line.startsWith('event: ')) {
      type = line.slice('event: '.length);
    } else if (line.startsWith('data: ')) {
      data += line.slice('data: '.length);
    }
  }
  const payload: unknown = data === '' ? {} : JSON.parse(data);
  return chatEventSchema.parse({ ...(payload as object), type });
}

/** Splits a byte stream into SSE frames: push text as it arrives, get every finished event back. */
export interface ChatStreamDecoder {
  push: (chunk: string) => ChatEvent[];
}

export function createChatStreamDecoder(): ChatStreamDecoder {
  let buffer: string = '';
  return {
    push(chunk: string): ChatEvent[] {
      buffer += chunk;
      const frames: string[] = buffer.split(FRAME_SEPARATOR);
      buffer = frames.splice(-1, 1).join('');
      return frames.filter((frame) => frame.trim() !== '').map(decodeChatFrame);
    },
  };
}
