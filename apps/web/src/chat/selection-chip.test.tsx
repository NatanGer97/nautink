import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetSelectionChip } from './chat-selection.ts';
import { eventsResponse, replyEvents } from '../../tests/chat-stream.ts';
import { App } from '../app.tsx';
import { publishSelection } from '../edit/selection/canvas-selection.ts';
import { useUiStore } from '../state/ui-store.ts';
import { selectActiveDiagram, useWorkspaceStore } from '../workspace/use-workspace.ts';

import type { ChatRequest } from '@nautink/contracts/chat';
import type { Mock } from 'vitest';

let fetchMock: Mock<(input: string, init?: RequestInit) => Promise<Response>>;

beforeEach(() => {
  fetchMock = vi.fn(async (input: string) =>
    input === '/api/chat'
      ? Promise.resolve(eventsResponse(replyEvents('No change needed.')))
      : Promise.reject(new TypeError('Failed to fetch')),
  );
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  resetSelectionChip();
});

function chatRequests(): ChatRequest[] {
  return fetchMock.mock.calls
    .filter(([input]) => input === '/api/chat')
    .map(([, init]) => JSON.parse(init?.body as string) as ChatRequest);
}

async function renderApp(): Promise<{ user: ReturnType<typeof userEvent.setup>; id: string }> {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole('group', { name: 'Diagram preview' });
  const id = selectActiveDiagram(useWorkspaceStore.getState())?.id ?? '';
  return { user, id };
}

function select(id: string, count: number): void {
  const items = [
    { id: 'a', label: 'Start', kind: 'node' },
    { id: 'b', label: 'Done', kind: 'node' },
    { id: 'L_a_b_0', label: 'Start → Done', kind: 'link' },
  ].slice(0, count);
  act(() => {
    publishSelection(id, items);
  });
}

async function send(user: ReturnType<typeof userEvent.setup>, text: string): Promise<void> {
  act(() => {
    screen.getByLabelText('Message Claude').focus();
  });
  await user.keyboard(text);
  await user.keyboard('{Meta>}{Enter}{/Meta}');
  await waitFor(() => {
    expect(chatRequests().at(-1)?.message).toBe(text);
  });
  await screen.findByText('Claude replied.', {}, { timeout: 10_000 });
}

describe('selection chip', () => {
  it('names the selection by kind and count', async () => {
    const { id } = await renderApp();
    expect(screen.queryByTestId('selection-chip')).toBeNull();
    select(id, 2);
    expect(screen.getByTestId('selection-chip').textContent).toBe('2 nodes selected');
    select(id, 3);
    expect(screen.getByTestId('selection-chip').textContent).toBe('3 items selected');
  });

  it('ignores another diagram’s selection', async () => {
    await renderApp();
    select('another-diagram', 1);
    expect(screen.queryByTestId('selection-chip')).toBeNull();
  });

  it('sends the selection while it shows, and not once removed', async () => {
    const { user, id } = await renderApp();
    select(id, 2);
    await send(user, 'Rename these');
    expect(chatRequests().at(-1)?.selection).toEqual({
      ids: ['a', 'b'],
      labels: ['Start', 'Done'],
      kinds: ['node', 'node'],
    });
    await user.click(screen.getByRole('button', { name: 'Remove “2 nodes selected”' }));
    expect(screen.queryByTestId('selection-chip')).toBeNull();
    await send(user, 'Rename everything');
    expect(chatRequests().at(-1)?.selection).toBeNull();
    select(id, 1);
    expect(screen.getByTestId('selection-chip').textContent).toBe('1 node selected');
  });

  it('shows in the floating prompt bar while the chat is closed', async () => {
    const { id } = await renderApp();
    act(() => {
      useUiStore.getState().setActivePanel(null);
    });
    select(id, 1);
    const bar = screen.getByLabelText('Ask Claude to change this diagram').parentElement;
    expect(within(bar ?? document.body).getByTestId('selection-chip').textContent).toBe(
      '1 node selected',
    );
  });
});
