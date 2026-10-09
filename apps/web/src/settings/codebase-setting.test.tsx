import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from '../app.tsx';
import { useUiStore } from '../state/ui-store.ts';

let repoDir: string | null = null;

beforeEach(() => {
  repoDir = null;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, init?: RequestInit) => {
      if (input === '/api/info') {
        return Promise.resolve(new Response(JSON.stringify({ repoDir })));
      }
      if (input === '/api/repo') {
        const { path } = JSON.parse(init?.body as string) as { path: string | null };
        if (path === '/missing') {
          return Promise.resolve(
            new Response(JSON.stringify({ error: 'Folder not found: /missing' }), { status: 400 }),
          );
        }
        repoDir = path;
        return Promise.resolve(new Response(JSON.stringify({ repoDir })));
      }
      return Promise.reject(new TypeError('Failed to fetch'));
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('codebase setting', () => {
  it('chooses a folder, shows server errors inline, badges the top bar and clears', async () => {
    useUiStore.getState().setSettingsOpen(true);
    const user = userEvent.setup();
    render(<App />);
    const settings = await screen.findByRole('dialog', { name: 'Settings' });
    expect(await within(settings).findByText('None')).toBeTruthy();
    await user.click(within(settings).getByRole('button', { name: 'Choose folder' }));
    const field = within(settings).getByRole('textbox', { name: 'Folder path' });
    await waitFor(() => {
      expect(document.activeElement).toBe(field);
    });
    await user.type(field, '/missing{Enter}');
    expect((await within(settings).findByRole('alert')).textContent).toBe(
      'Folder not found: /missing',
    );
    await user.clear(field);
    await user.type(field, '/Users/me/code/shop');
    await user.click(within(settings).getByRole('button', { name: 'Save' }));
    expect(await within(settings).findByText('/Users/me/code/shop')).toBeTruthy();
    expect(within(settings).queryByRole('alert')).toBeNull();
    const banner = screen.getByRole('banner');
    expect(within(banner).getByRole('button', { name: 'Codebase: shop' })).toBeTruthy();
    await user.click(within(settings).getByRole('button', { name: 'Clear' }));
    expect(await within(settings).findByText('None')).toBeTruthy();
    expect(within(banner).queryByRole('button', { name: /^Codebase/ })).toBeNull();
  });

  it('shows the folder the server already has, and cancels an edit', async () => {
    repoDir = '/srv/api';
    useUiStore.getState().setSettingsOpen(true);
    const user = userEvent.setup();
    render(<App />);
    const settings = await screen.findByRole('dialog', { name: 'Settings' });
    expect(await within(settings).findByText('/srv/api')).toBeTruthy();
    await user.click(within(settings).getByRole('button', { name: 'Change' }));
    expect(within(settings).getByRole('textbox', { name: 'Folder path' })).toHaveProperty(
      'value',
      '/srv/api',
    );
    await user.click(within(settings).getByRole('button', { name: 'Cancel' }));
    expect(within(settings).getByText('/srv/api')).toBeTruthy();
  });

  it('says so when the server cannot be reached', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))),
    );
    useUiStore.getState().setSettingsOpen(true);
    render(<App />);
    const settings = await screen.findByRole('dialog', { name: 'Settings' });
    expect(
      await within(settings).findByText('Could not read this setting from the local server.'),
    ).toBeTruthy();
  });
});
