import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { sendChat } from './send-chat.ts';
import { App } from '../app.tsx';

/** A chat request that stays open until it is aborted, so Claude keeps "working". */
async function pendingChat(init?: RequestInit): Promise<Response> {
  return new Promise<Response>((...settle) => {
    init?.signal?.addEventListener('abort', () => {
      settle[1](new DOMException('Aborted', 'AbortError'));
    });
  });
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, init?: RequestInit) =>
      input === '/api/chat' ? pendingChat(init) : Promise.reject(new TypeError('offline')),
    ),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Claude at work', () => {
  it('shows the working pill and the thinking dots, and Stop ends both', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('group', { name: 'Diagram preview' }, { timeout: 10_000 });
    act(() => {
      void sendChat('Add a step');
    });
    const pill = await screen.findByRole('region', { name: 'Claude is working' });
    expect(pill.textContent).toContain('Claude is editing');
    expect(pill.textContent).toContain('Thinking…');
    expect(screen.getByRole('main', { name: 'Canvas' }).hasAttribute('data-claude-working')).toBe(
      true,
    );
    await user.click(within(pill).getByRole('button', { name: 'Stop' }));
    await waitFor(() => {
      expect(screen.queryByRole('region', { name: 'Claude is working' })).toBeNull();
    });
    expect(screen.getByRole('main', { name: 'Canvas' }).hasAttribute('data-claude-working')).toBe(
      false,
    );
  });
});
