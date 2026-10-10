import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { useReviewStore } from './review-store.ts';
import { eventsResponse, replyEvents } from '../../tests/chat-stream.ts';
import { fakeMonaco, fakeMonacoState, resetFakeMonaco } from '../../tests/fake-monaco.ts';
import { App } from '../app.tsx';
import { resetChatState } from '../chat/chat-store.ts';
import { viewVersion } from '../history/viewed-version.ts';
import { loadMermaid } from '../mermaid/mermaid-instance.ts';
import { useUiStore } from '../state/ui-store.ts';
import { selectActiveDiagram, useWorkspaceStore } from '../workspace/use-workspace.ts';

import type { Version } from '@nautink/storage/records';

vi.mock('../code/load-monaco.ts', () => ({
  loadMonaco: async (): Promise<typeof fakeMonaco> => Promise.resolve(fakeMonaco),
}));

/** A turn ends after Mermaid checks and compares the reply, which is slow under a loaded run. */
const TURN_END = { timeout: 10_000 };

const AFTER = 'flowchart TD\n  A --> B';

let replies: (() => Response)[] = [];

beforeAll(async () => {
  await loadMermaid();
}, 30_000);

beforeEach(() => {
  replies = [];
  resetFakeMonaco();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string) => {
      const next = input === '/api/chat' ? replies.shift() : undefined;
      return next === undefined
        ? Promise.reject(new TypeError('Failed to fetch'))
        : Promise.resolve(next());
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  resetChatState();
});

function fenced(code: string): string {
  return `Done.\n\`\`\`mermaid\n${code}\n\`\`\``;
}

const code = (): string | undefined => selectActiveDiagram(useWorkspaceStore.getState())?.code;

function chatPanel(): HTMLElement {
  return screen.getByRole('complementary', { name: 'Chat' });
}

async function renderAndSend(reply: string): Promise<ReturnType<typeof userEvent.setup>> {
  replies.push(() => eventsResponse(replyEvents(fenced(reply))));
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole('group', { name: 'Diagram preview' });
  act(() => {
    screen.getByLabelText('Message Claude').focus();
  });
  await user.keyboard('Change it');
  await user.keyboard('{Meta>}{Enter}{/Meta}');
  return user;
}

async function proposalBar(): Promise<HTMLElement> {
  return screen.findByRole('region', { name: "Claude's proposal" }, TURN_END);
}

describe('reviewing a Codex change', () => {
  it('names Codex in the proposal bar and on the canvas', async () => {
    useUiStore.getState().setAgent('codex');
    replies.push(() => eventsResponse(replyEvents(fenced(AFTER))));
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('group', { name: 'Diagram preview' });
    act(() => {
      screen.getByLabelText('Message Codex').focus();
    });
    await user.keyboard('Change it{Meta>}{Enter}{/Meta}');
    const bar = await screen.findByRole('region', { name: "Codex's proposal" }, TURN_END);
    await waitFor(() => {
      expect(bar.textContent).toContain('Codex proposes 3 changes');
    }, TURN_END);
  });
});

describe('reviewing a change in the app', () => {
  it('shows the bar and the waiting card, rejects, shows again and accepts with Enter', async () => {
    const user = await renderAndSend(AFTER);
    const bar = await proposalBar();
    await waitFor(() => {
      expect(bar.textContent).toContain('Claude proposes 3 changes');
    }, TURN_END);
    expect(within(bar).getByText('Added 3')).toBeTruthy();
    expect(within(chatPanel()).getByText('Waiting for your review')).toBeTruthy();
    expect(code()).toBe('flowchart TD\n');
    await user.click(within(bar).getByRole('button', { name: 'Reject' }));
    expect(screen.queryByRole('region', { name: "Claude's proposal" })).toBeNull();
    expect(within(chatPanel()).getByText('Rejected · diagram unchanged')).toBeTruthy();
    await user.click(within(chatPanel()).getByRole('button', { name: 'Show again' }));
    await proposalBar();
    act(() => {
      (document.activeElement as HTMLElement | null)?.blur();
    });
    fireEvent.keyDown(document.body, { key: 'Enter' });
    await waitFor(() => {
      expect(code()).toBe(AFTER);
    });
    expect(await within(chatPanel()).findByText(/· 3 changes/)).toBeTruthy();
  });

  it('undo rejects an open proposal instead of changing the code, and redo waits', async () => {
    const user = await renderAndSend(AFTER);
    await proposalBar();
    const banner = screen.getByRole('banner');
    expect(within(banner).getByRole('button', { name: 'Redo' }).getAttribute('aria-disabled')).toBe(
      'true',
    );
    await user.click(within(banner).getByRole('button', { name: "Undo: Reject Claude's change" }));
    expect(screen.queryByRole('region', { name: "Claude's proposal" })).toBeNull();
    expect(within(chatPanel()).getByText('Rejected · diagram unchanged')).toBeTruthy();
    expect(code()).toBe('flowchart TD\n');
    await user.click(within(chatPanel()).getByRole('button', { name: 'Show again' }));
    await proposalBar();
    act(() => {
      (document.activeElement as HTMLElement | null)?.blur();
    });
    fireEvent.keyDown(window, { key: 'z', metaKey: true });
    expect(screen.queryByRole('region', { name: "Claude's proposal" })).toBeNull();
    expect(code()).toBe('flowchart TD\n');
  });

  it('accepts from the bar, and hides the bar while a version is viewed', async () => {
    const user = await renderAndSend(AFTER);
    const bar = await proposalBar();
    const version: Version = {
      id: 'v1',
      diagramId: selectActiveDiagram(useWorkspaceStore.getState())!.id,
      code: 'flowchart LR',
      createdAt: 1,
      kind: 'manual',
      label: '',
      prompt: '',
    };
    act(() => {
      viewVersion(version);
    });
    expect(screen.queryByRole('region', { name: "Claude's proposal" })).toBeNull();
    act(() => {
      viewVersion(null);
    });
    await user.click(within(await proposalBar()).getByRole('button', { name: 'Accept' }));
    expect(bar.isConnected).toBe(false);
    await waitFor(() => {
      expect(code()).toBe(AFTER);
    });
  });

  it('reviews a code-only type as a diff in the code drawer', async () => {
    const user = await renderAndSend('pie\n  "A" : 1');
    const drawer = await screen.findByRole('region', { name: 'Code' }, TURN_END);
    await waitFor(() => {
      expect(useUiStore.getState().isCodeDrawerOpen).toBe(true);
    }, TURN_END);
    const bar = await within(drawer).findByRole('region', { name: "Claude's proposal" }, TURN_END);
    await waitFor(() => {
      expect(fakeMonacoState.diffEditors[0]?.models?.modified.getValue()).toBe('pie\n  "A" : 1');
    });
    act(() => {
      useUiStore.getState().setCodeDrawerOpen(false);
    });
    const canvasBar = await proposalBar();
    await user.click(within(canvasBar).getByRole('button', { name: 'Show diff' }));
    expect(useUiStore.getState().isCodeDrawerOpen).toBe(true);
    expect(bar.isConnected).toBe(false);
    await user.click(
      within(
        await within(screen.getByRole('region', { name: 'Code' })).findByRole('region', {
          name: "Claude's proposal",
        }),
      ).getByRole('button', { name: 'Reject' }),
    );
    expect(useReviewStore.getState().open).toEqual({});
    expect(fakeMonacoState.diffEditors[0]?.isDisposed).toBe(true);
  });

  it("opens an accepted or rejected reply's diff in the code drawer from its card", async () => {
    const user = await renderAndSend(AFTER);
    await user.click(within(await proposalBar()).getByRole('button', { name: 'Reject' }));
    const rejected = within(chatPanel()).getByText('Rejected · diagram unchanged').parentElement!;
    await user.click(within(rejected).getByRole('button', { name: 'Diff' }));
    expect(useUiStore.getState().isCodeDrawerOpen).toBe(true);
    const drawer = screen.getByRole('region', { name: 'Code' });
    expect(
      await within(drawer).findByRole('region', { name: 'Code changes from this reply' }),
    ).toBeTruthy();
    await waitFor(() => {
      expect(fakeMonacoState.diffEditors.at(-1)?.models?.original.getValue()).toBe(
        'flowchart TD\n',
      );
    });
    expect(fakeMonacoState.diffEditors.at(-1)?.models?.modified.getValue()).toBe(AFTER);
    await user.click(within(drawer).getByRole('button', { name: 'Back to code' }));
    expect(
      within(drawer).queryByRole('region', { name: 'Code changes from this reply' }),
    ).toBeNull();
    await user.click(within(chatPanel()).getByRole('button', { name: 'Show again' }));
    await user.click(within(await proposalBar()).getByRole('button', { name: 'Accept' }));
    await waitFor(() => {
      expect(code()).toBe(AFTER);
    });
    await user.click(within(chatPanel()).getByRole('button', { name: 'Diff' }));
    expect(
      await within(drawer).findByRole('region', { name: 'Code changes from this reply' }),
    ).toBeTruthy();
  });

  it('keeps the code read-only and shows the diff while a visual proposal is open', async () => {
    await renderAndSend(AFTER);
    await proposalBar();
    act(() => {
      useUiStore.getState().setCodeDrawerOpen(true);
    });
    const drawer = screen.getByRole('region', { name: 'Code' });
    expect(within(drawer).getByText(/accept or reject it on the canvas/)).toBeTruthy();
    expect(
      await within(drawer).findByRole('region', { name: 'Proposed code changes' }),
    ).toBeTruthy();
  });
});
