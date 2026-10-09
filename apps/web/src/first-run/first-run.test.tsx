import { openNautinkDb } from '@nautink/storage/db';
import { createDiagram } from '@nautink/storage/diagrams';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { firstRunType, startFromPrompt } from './first-run-prompt.ts';
import { FIRST_RUN_DONE_KEY, useFirstRunStore } from './first-run-store.ts';
import { showFirstRun } from '../../tests/history-fixtures.ts';
import { App } from '../app.tsx';
import { pickFiles } from '../lib/pick-files.ts';
import { useUiStore } from '../state/ui-store.ts';
import {
  selectActiveDiagram,
  selectActiveStack,
  useWorkspaceStore,
} from '../workspace/use-workspace.ts';

vi.mock('../lib/pick-files.ts', () => ({ pickFiles: vi.fn() }));

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))),
  );
  showFirstRun();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.mocked(pickFiles).mockReset();
});

async function renderFirstRun(): Promise<ReturnType<typeof userEvent.setup>> {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole('heading', { name: 'What do you want to diagram?' });
  return user;
}

function active(): ReturnType<typeof selectActiveDiagram> {
  return selectActiveDiagram(useWorkspaceStore.getState());
}

describe('first run', () => {
  it('shows the empty state instead of the canvas, with no panel open', async () => {
    await renderFirstRun();
    expect(screen.getByRole('main', { name: 'Get started' })).toBeTruthy();
    expect(screen.queryByRole('main', { name: 'Canvas' })).toBeNull();
    expect(useUiStore.getState().activePanel).toBeNull();
  });

  it('starts the diagram from the prompt: type header, chat draft, chat open', async () => {
    const user = await renderFirstRun();
    expect(screen.getByRole('button', { name: 'Create' }).hasAttribute('disabled')).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Database for a blog' }));
    expect(screen.getByRole('radio', { name: 'ER' }).getAttribute('aria-checked')).toBe('true');
    await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(active()?.code).toBe('erDiagram\n');
    expect(active()?.draft).toBe('Database for a blog');
    expect(selectActiveStack(useWorkspaceStore.getState())?.entries.at(-1)?.label).toBe(
      'Started a er',
    );
    expect(useUiStore.getState().activePanel).toBe('chat');
    expect(window.localStorage.getItem(FIRST_RUN_DONE_KEY)).toBe('1');
    expect(await screen.findByRole('main', { name: 'Canvas' })).toBeTruthy();
  });

  it('submits with Enter and keeps the code when the type is Auto', async () => {
    const user = await renderFirstRun();
    await user.type(
      screen.getByLabelText('Describe your diagram'),
      'A checkout flow{Shift>}{Enter}{/Shift}with retries{Enter}',
    );
    expect(active()?.code).toBe('flowchart TD\n');
    expect(active()?.draft).toBe('A checkout flow\nwith retries');
  });

  it('leaves for a blank canvas, and stays away after a reload', async () => {
    const user = await renderFirstRun();
    await user.click(screen.getByRole('button', { name: /^Blank canvas/ }));
    expect(await screen.findByRole('main', { name: 'Canvas' })).toBeTruthy();
    expect(useFirstRunStore.getState().isDone).toBe(true);
  });

  it('leaves when a panel is opened from the rail', async () => {
    const user = await renderFirstRun();
    await user.click(screen.getByRole('button', { name: 'History' }));
    expect(await screen.findByRole('complementary', { name: 'History' })).toBeTruthy();
    expect(screen.getByRole('main', { name: 'Canvas' })).toBeTruthy();
  });

  it('opens the gallery, and leaves once a template creates a diagram', async () => {
    const user = await renderFirstRun();
    await user.click(screen.getByRole('button', { name: /14 examples to adapt/ }));
    const gallery = await screen.findByRole('dialog', { name: 'New diagram' });
    await user.click(within(gallery).getByRole('button', { name: 'Use the kanban example' }));
    expect(await screen.findByRole('main', { name: 'Canvas' })).toBeTruthy();
    expect(useFirstRunStore.getState().isDone).toBe(true);
  });

  it('opens settings for a codebase, and the picker for an import or a v1 backup', async () => {
    vi.mocked(pickFiles).mockResolvedValue([]);
    const user = await renderFirstRun();
    await user.click(screen.getByRole('button', { name: /^From a codebase/ }));
    expect(useUiStore.getState().isSettingsOpen).toBe(true);
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: /^Import/ }));
    await user.click(screen.getByRole('button', { name: 'Restore its backup.' }));
    await waitFor(() => {
      expect(pickFiles).toHaveBeenCalledTimes(2);
    });
    expect(vi.mocked(pickFiles).mock.calls[1]?.[0].accept).toContain('.json');
  });

  it('does not show once the workspace has real work in it', async () => {
    const db = await openNautinkDb();
    await createDiagram(db, { code: 'pie title Mine\n  "a" : 1\n' });
    db.close();
    render(<App />);
    expect(await screen.findByRole('group', { name: 'Diagram preview' })).toBeTruthy();
    expect(screen.queryByRole('main', { name: 'Get started' })).toBeNull();
  });

  it('does nothing for an empty prompt', () => {
    startFromPrompt('  ', firstRunType('flowchart'));
    expect(useFirstRunStore.getState().isDone).toBe(false);
    expect(() => firstRunType('mystery')).toThrow('Unknown diagram type "mystery".');
  });
});
