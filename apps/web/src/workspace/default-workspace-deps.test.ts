import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ACTIVE_ID_KEY,
  createDefaultWorkspaceDeps,
  downloadTextFile,
} from './default-workspace-deps.ts';
import { flushOnPageHide } from './use-workspace-lifecycle.ts';
import { createTestWorkspace } from '../../tests/workspace-fixtures.ts';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('default workspace deps', () => {
  it('remembers the open diagram in localStorage', () => {
    const { activeIdStorage } = createDefaultWorkspaceDeps();
    expect(activeIdStorage.read()).toBeNull();
    activeIdStorage.write('abc');
    expect(window.localStorage.getItem(ACTIVE_ID_KEY)).toBe('abc');
    expect(activeIdStorage.read()).toBe('abc');
  });

  it('tolerates blocked storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const { activeIdStorage } = createDefaultWorkspaceDeps();
    expect(activeIdStorage.read()).toBeNull();
    expect(() => {
      activeIdStorage.write('abc');
    }).not.toThrow();
  });

  it('opens the nautink database and reads the clock', async () => {
    const deps = createDefaultWorkspaceDeps();
    const db = await deps.openDb();
    expect(db.name).toBe('nautink');
    db.close();
    expect(deps.now()).toBeGreaterThan(0);
    expect(deps.saveDelayMs).toBe(400);
  });

  it('downloads through a temporary link', () => {
    const createObjectURL = vi.fn(() => 'blob:diagram');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    downloadTextFile({ fileName: 'a.mmd', text: 'pie' });
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:diagram');
    vi.unstubAllGlobals();
  });
});

describe('flushOnPageHide', () => {
  it('flushes when the page is hidden or closed, until cleaned up', () => {
    const workspace = createTestWorkspace();
    const flush = vi.spyOn(workspace.store.getState(), 'flushSaves');
    workspace.store.setState({ flushSaves: flush });
    const cleanup = flushOnPageHide(workspace.store);
    window.dispatchEvent(new Event('pagehide'));
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(flush).toHaveBeenCalledTimes(2);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    cleanup();
    window.dispatchEvent(new Event('pagehide'));
    expect(flush).toHaveBeenCalledTimes(2);
  });
});
