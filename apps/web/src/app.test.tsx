import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from './app.tsx';
import { NARROW_QUERY } from './lib/use-media-query.ts';
import { useUiStore } from './state/ui-store.ts';
import { useWorkspaceStore } from './workspace/use-workspace.ts';
import { setMediaQuery } from '../tests/media.ts';

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderApp(): ReturnType<typeof userEvent.setup> {
  const user = userEvent.setup();
  render(<App />);
  return user;
}

describe('App shell', () => {
  it('renders the frame with chat open by default', () => {
    renderApp();
    expect(screen.getByRole('banner')).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeTruthy();
    expect(screen.getByRole('complementary', { name: 'Chat' })).toBeTruthy();
    expect(screen.getByRole('main', { name: 'Canvas' })).toBeTruthy();
    expect(screen.getByRole('contentinfo').textContent).toContain('Empty');
  });

  it('switches rail panels, one at a time, and collapses them', async () => {
    const user = renderApp();
    await user.click(screen.getByRole('button', { name: 'History' }));
    expect(screen.getByRole('complementary', { name: 'History' })).toBeTruthy();
    expect(screen.queryByRole('complementary', { name: 'Chat' })).toBeNull();
    expect(screen.getByRole('button', { name: 'History' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    await user.click(screen.getByRole('button', { name: 'Diagrams' }));
    expect(screen.getByRole('complementary', { name: 'Diagrams' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Close panel' }));
    expect(screen.queryByRole('complementary')).toBeNull();
    expect(screen.getByLabelText('Ask Claude to change this diagram')).toBeTruthy();
  });

  it('toggles the code drawer from the top bar and closes it from the drawer', async () => {
    const user = renderApp();
    await user.click(screen.getByRole('button', { name: 'Code' }));
    expect(screen.getByRole('region', { name: 'Code' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Close code' }));
    expect(screen.queryByRole('region', { name: 'Code' })).toBeNull();
  });

  it('opens the palette with the keyboard and runs a command', async () => {
    const user = renderApp();
    await user.keyboard('{Control>}k{/Control}');
    const palette = await screen.findByRole('dialog', { name: 'Command palette' });
    await user.type(within(palette).getByRole('combobox'), 'show history');
    await user.keyboard('{Enter}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Command palette' })).toBeNull();
    });
    expect(screen.getByRole('complementary', { name: 'History' })).toBeTruthy();
  });

  it('opens the palette from the top bar and closes it with Escape', async () => {
    const user = renderApp();
    await user.click(screen.getByRole('button', { name: 'Search or run a command' }));
    expect(await screen.findByRole('dialog', { name: 'Command palette' })).toBeTruthy();
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Command palette' })).toBeNull();
    });
  });

  it('focuses the chat composer with ⌘/, opening the chat panel first', async () => {
    useUiStore.getState().setActivePanel(null);
    const user = renderApp();
    await user.keyboard('{Meta>}/{/Meta}');
    expect(document.activeElement).toBe(screen.getByLabelText('Message Claude'));
  });

  it('changes the theme in settings and shows the server as not connected', async () => {
    const user = renderApp();
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    const settings = await screen.findByRole('dialog', { name: 'Settings' });
    await user.click(await within(settings).findByRole('radio', { name: 'Dark' }));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(await within(settings).findByText('Not connected')).toBeTruthy();
    expect(within(settings).getByText(/Failed to fetch/)).toBeTruthy();
    await user.click(within(settings).getByRole('button', { name: 'Check again' }));
    expect(await within(settings).findByText('Not connected')).toBeTruthy();
    await user.click(within(settings).getByRole('radio', { name: 'Light' }));
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('shows Claude Code as connected when the server finds it', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              claude: { isFound: true, version: '2.1.0', error: null },
              codex: { isFound: true, version: '0.154.0', error: null },
            }),
          ),
        ),
      ),
    );
    useUiStore.getState().setSettingsOpen(true);
    renderApp();
    const settings = await screen.findByRole('dialog', { name: 'Settings' });
    expect(await within(settings).findByText('Connected')).toBeTruthy();
    expect(within(settings).getByText('2.1.0')).toBeTruthy();
  });

  it('picks a default model in settings', async () => {
    useUiStore.getState().setSettingsOpen(true);
    const user = renderApp();
    const settings = await screen.findByRole('dialog', { name: 'Settings' });
    await user.click(within(settings).getByRole('combobox', { name: 'Default model' }));
    await user.click(await screen.findByRole('option', { name: 'Sonnet' }));
    expect(useUiStore.getState().defaultModel).toBe('sonnet');
    expect(screen.getByRole('contentinfo').textContent).toContain('Sonnet');
    await user.click(within(settings).getByRole('combobox', { name: 'Default model' }));
    await user.click(await screen.findByRole('option', { name: 'Default' }));
    expect(useUiStore.getState().defaultModel).toBeNull();
  });

  it('picks Codex in settings: the connection row and the models follow the agent', async () => {
    const health = {
      claude: { isFound: true, version: '2.1.0', error: null },
      codex: { isFound: false, version: null, error: '"codex" was not found.' },
    };
    const models = { claude: [], codex: [{ id: 'gpt-6-astra', label: 'GPT-6-Astra' }] };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        Promise.resolve(new Response(JSON.stringify(url === '/api/models' ? models : health))),
      ),
    );
    useUiStore.getState().setSettingsOpen(true);
    const user = renderApp();
    const settings = await screen.findByRole('dialog', { name: 'Settings' });
    expect(await within(settings).findByText('Claude Code')).toBeTruthy();
    await user.click(within(settings).getByRole('radio', { name: 'Codex' }));
    expect(useUiStore.getState().agent).toBe('codex');
    expect(await within(settings).findByText('Codex CLI')).toBeTruthy();
    expect(await within(settings).findByText('"codex" was not found.')).toBeTruthy();
    await user.click(within(settings).getByRole('combobox', { name: 'Default model' }));
    await user.click(await screen.findByRole('option', { name: 'GPT-6-Astra' }));
    expect(useUiStore.getState().defaultModel).toBe('gpt-6-astra');
    expect(screen.getByRole('contentinfo').textContent).toContain('GPT-6-Astra');
    await user.click(within(settings).getByRole('radio', { name: 'Claude' }));
    expect(useUiStore.getState()).toMatchObject({ agent: 'claude', defaultModel: null });
  });

  it('turns change review off and on in settings, on by default', async () => {
    useUiStore.getState().setSettingsOpen(true);
    const user = renderApp();
    const settings = await screen.findByRole('dialog', { name: 'Settings' });
    const toggle = within(settings).getByRole('switch', { name: 'Review changes before applying' });
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    await user.click(toggle);
    expect(useUiStore.getState().shouldReviewChanges).toBe(false);
    await user.click(toggle);
    expect(useUiStore.getState().shouldReviewChanges).toBe(true);
  });

  it('opens the template gallery and hands off to chat', async () => {
    const user = renderApp();
    await user.click(screen.getByRole('button', { name: 'Templates' }));
    const dialog = await screen.findByRole('dialog', { name: 'New diagram' });
    await user.click(within(dialog).getByRole('button', { name: /^Or describe it/ }));
    expect(useUiStore.getState().isTemplatesOpen).toBe(false);
    expect(useUiStore.getState().activePanel).toBe('chat');
  });

  it('starts new diagrams from the diagrams panel', async () => {
    useUiStore.getState().setActivePanel('diagrams');
    const user = renderApp();
    await screen.findByRole('option');
    await user.click(screen.getByRole('button', { name: 'New diagram' }));
    expect(await screen.findAllByRole('option')).toHaveLength(2);
    expect(useWorkspaceStore.getState().diagrams).toHaveLength(2);
  });
});

describe('App shell on a narrow window', () => {
  it('starts with overlays closed and opens panels and code as sheets', async () => {
    setMediaQuery(NARROW_QUERY, true);
    useUiStore.getState().setCodeDrawerOpen(true);
    const user = renderApp();
    expect(screen.queryByRole('dialog')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'History' }));
    const sheet = await screen.findByRole('dialog', { name: 'History' });
    await user.click(within(sheet).getByRole('button', { name: 'Close panel' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'History' })).toBeNull();
    });
    await user.click(screen.getByRole('button', { name: 'Code' }));
    expect(await screen.findByRole('dialog', { name: 'Code' })).toBeTruthy();
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(useUiStore.getState().isCodeDrawerOpen).toBe(false);
    });
  });
});
