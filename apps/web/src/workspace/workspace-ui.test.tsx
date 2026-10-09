import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useWorkspaceStore } from './use-workspace.ts';
import { App } from '../app.tsx';

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function renderLoadedApp(): Promise<ReturnType<typeof userEvent.setup>> {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByLabelText('Diagram code');
  return user;
}

describe('workspace in the shell', () => {
  it('shows the open diagram in the canvas, top bar and status bar', async () => {
    await renderLoadedApp();
    expect(screen.getByLabelText('Diagram code').textContent).toBe('flowchart TD\n');
    const banner = screen.getByRole('banner');
    expect(within(banner).getByRole('button', { name: /^Flowchart · / })).toBeTruthy();
    expect(within(banner).getByText('Saved')).toBeTruthy();
    const footer = screen.getByRole('contentinfo');
    expect(footer.textContent).toContain('Flowchart');
    expect(footer.textContent).toContain('1 line');
    expect(document.title).toMatch(/^Flowchart · .* · Nautink$/);
  });

  it('renames the diagram from the top bar title', async () => {
    const user = await renderLoadedApp();
    const banner = screen.getByRole('banner');
    await user.click(within(banner).getByRole('button', { name: /^Flowchart · / }));
    await user.keyboard('Checkout flow{Enter}');
    expect(within(banner).getByRole('button', { name: 'Checkout flow' })).toBeTruthy();
    await user.click(within(banner).getByRole('button', { name: 'Checkout flow' }));
    await user.keyboard('Other{Escape}');
    expect(within(banner).getByRole('button', { name: 'Checkout flow' })).toBeTruthy();
    await user.click(within(banner).getByRole('button', { name: 'Checkout flow' }));
    await user.clear(within(banner).getByLabelText('Diagram title'));
    await user.tab();
    expect(within(banner).getByRole('button', { name: 'Checkout flow' })).toBeTruthy();
  });

  it('shows the save state as changes are written', async () => {
    await renderLoadedApp();
    const footer = screen.getByRole('contentinfo');
    useWorkspaceStore.getState().applyEdit('flowchart LR\n  a --> b\n', {
      label: 'Pasted code',
      source: 'code',
    });
    expect(await within(footer).findByText('Saving…')).toBeTruthy();
    expect(footer.textContent).toContain('2 lines');
    await waitFor(() => {
      expect(within(footer).getByText('Saved')).toBeTruthy();
    });
    useWorkspaceStore.setState({ saveState: 'error' });
    expect(await within(footer).findByText('Not saved')).toBeTruthy();
  });
});
