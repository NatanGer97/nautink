import { openNautinkDb } from '@nautink/storage/db';
import { vi } from 'vitest';

import { createWorkspaceStore } from '../src/workspace/workspace-store.ts';

import type { WorkspaceDeps } from '../src/workspace/workspace-deps.ts';
import type { WorkspaceStore } from '../src/workspace/workspace-state.ts';
import type { NautinkDb } from '@nautink/storage/db';
import type { Mock } from 'vitest';

export interface TestWorkspace {
  store: WorkspaceStore;
  info: Mock<WorkspaceDeps['notify']['info']>;
  error: Mock<WorkspaceDeps['notify']['error']>;
  download: Mock<WorkspaceDeps['download']>;
  remembered: { id: string | null };
  /** The name of the database the store opens; seed it with `openNautinkDb(dbName)`. */
  dbName: string;
  clock: { now: number };
  /** The database the store opened, once it has. */
  db: () => NautinkDb;
}

let databases = 0;

/** A workspace store over a fresh database, a fake clock, and spies for notices and downloads. */
export function createTestWorkspace(overrides: Partial<WorkspaceDeps> = {}): TestWorkspace {
  databases += 1;
  const name = `workspace-test-${String(databases)}`;
  let opened: NautinkDb | undefined;
  const fixture = {
    info: vi.fn<WorkspaceDeps['notify']['info']>(),
    error: vi.fn<WorkspaceDeps['notify']['error']>(),
    download: vi.fn<WorkspaceDeps['download']>(),
    remembered: { id: null as string | null },
    dbName: name,
    clock: { now: 1_000_000 },
    db: (): NautinkDb => {
      if (opened === undefined) {
        throw new Error('The test workspace has not opened its database yet.');
      }
      return opened;
    },
  };
  const store = createWorkspaceStore({
    openDb: async () => {
      opened = await openNautinkDb(name);
      return opened;
    },
    notify: { info: fixture.info, error: fixture.error },
    download: fixture.download,
    activeIdStorage: {
      read: () => fixture.remembered.id,
      write: (id) => {
        fixture.remembered.id = id;
      },
    },
    saveDelayMs: 5,
    now: () => fixture.clock.now,
    ...overrides,
  });
  return { ...fixture, store };
}

/** A test workspace that has finished loading. */
export async function loadedWorkspace(
  overrides: Partial<WorkspaceDeps> = {},
): Promise<TestWorkspace> {
  const workspace = createTestWorkspace(overrides);
  await workspace.store.getState().load();
  return workspace;
}
