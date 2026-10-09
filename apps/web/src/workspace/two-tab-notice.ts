import { useEffect } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';

/** The channel every Nautink tab of this browser joins. */
export const TAB_CHANNEL_NAME: string = 'nautink';

/** PRD §11: two tabs write the same diagrams, and the last write wins. */
export const TWO_TABS_MESSAGE: string =
  'Nautink is open in another tab. Edits made in both tabs overwrite each other.';

const TWO_TABS_TOAST_MS: number = 15_000;

/** One id per page load, so this tab ignores its own messages (React runs effects twice in dev). */
const TAB_ID: string = crypto.randomUUID();

/** The part of `BroadcastChannel` this module uses, so tests can pass a fake. */
export interface TabChannel {
  postMessage: (message: TabMessage) => void;
  close: () => void;
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
}

/** "I just opened" from a new tab, and "I am here too" in reply. */
export interface TabMessage {
  type: 'opened' | 'present';
  tabId: string;
}

const tabMessageSchema: z.ZodType<TabMessage> = z.object({
  type: z.enum(['opened', 'present']),
  tabId: z.string(),
});

/** Answers another tab's hello, and reports any other tab. Messages from this tab are ignored. */
function onTabMessage(
  channel: TabChannel,
  onOtherTab: () => void,
): (event: MessageEvent<unknown>) => void {
  return (event: MessageEvent<unknown>): void => {
    const parsed: z.ZodSafeParseResult<TabMessage> = tabMessageSchema.safeParse(event.data);
    if (!parsed.success || parsed.data.tabId === TAB_ID) {
      return;
    }
    if (parsed.data.type === 'opened') {
      channel.postMessage({ type: 'present', tabId: TAB_ID });
    }
    onOtherTab();
  };
}

function openBroadcastChannel(name: string): TabChannel | undefined {
  return typeof BroadcastChannel === 'undefined' ? undefined : new BroadcastChannel(name);
}

/**
 * Calls `onOtherTab` when another tab of the app is open: both the tab that opens second (from
 * the reply) and the one already open (from the hello). Returns the cleanup.
 */
export function watchOtherTabs(
  onOtherTab: () => void,
  openChannel: (name: string) => TabChannel | undefined = openBroadcastChannel,
): () => void {
  const channel: TabChannel | undefined = openChannel(TAB_CHANNEL_NAME);
  if (channel === undefined) {
    return (): void => undefined;
  }
  channel.onmessage = onTabMessage(channel, onOtherTab);
  channel.postMessage({ type: 'opened', tabId: TAB_ID });
  return (): void => {
    channel.close();
  };
}

/** Shows a warning toast while the app is mounted whenever a second tab is open. */
export function useTwoTabNotice(): void {
  useEffect(
    () =>
      watchOtherTabs(() => {
        toast.warning(TWO_TABS_MESSAGE, { id: 'two-tabs', duration: TWO_TABS_TOAST_MS });
      }),
    [],
  );
}
