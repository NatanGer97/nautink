import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TAB_CHANNEL_NAME, TWO_TABS_MESSAGE, watchOtherTabs } from './two-tab-notice.ts';
import { App } from '../app.tsx';

import type { TabChannel, TabMessage } from './two-tab-notice.ts';

class FakeChannel implements TabChannel {
  readonly sent: TabMessage[] = [];
  isClosed = false;
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null;

  postMessage(message: TabMessage): void {
    this.sent.push(message);
  }

  close(): void {
    this.isClosed = true;
  }

  receive(data: unknown): void {
    this.onmessage?.(new MessageEvent('message', { data }));
  }
}

describe('watchOtherTabs', () => {
  it('says hello, answers a new tab, and reports every other tab', () => {
    const channel = new FakeChannel();
    const onOtherTab = vi.fn();
    const names: string[] = [];
    const stop = watchOtherTabs(onOtherTab, (name) => {
      names.push(name);
      return channel;
    });
    expect(names).toEqual([TAB_CHANNEL_NAME]);
    const own = channel.sent[0];
    expect(own?.type).toBe('opened');
    channel.receive({ type: 'opened', tabId: 'other' });
    expect(channel.sent.at(-1)).toEqual({ type: 'present', tabId: own?.tabId });
    channel.receive({ type: 'present', tabId: 'third' });
    expect(onOtherTab).toHaveBeenCalledTimes(2);
    expect(channel.sent).toHaveLength(2);
    channel.receive(own);
    channel.receive({ type: 'other', tabId: 'x' });
    channel.receive('hello');
    expect(onOtherTab).toHaveBeenCalledTimes(2);
    stop();
    expect(channel.isClosed).toBe(true);
  });

  it('does nothing where BroadcastChannel is missing', () => {
    const onOtherTab = vi.fn();
    const stop = watchOtherTabs(onOtherTab, () => undefined);
    expect(() => {
      stop();
    }).not.toThrow();
  });
});

describe('two tabs in the app', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('warns when another tab says hello', async () => {
    render(<App />);
    const other = new BroadcastChannel(TAB_CHANNEL_NAME);
    other.postMessage({ type: 'opened', tabId: 'other-tab' });
    expect(await screen.findByText(TWO_TABS_MESSAGE)).toBeTruthy();
    other.close();
  });
});
