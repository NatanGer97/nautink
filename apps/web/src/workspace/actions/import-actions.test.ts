import { BACKUP_FORMAT, BACKUP_VERSION } from '@nautink/storage/backup-format';
import { getDiagram, newDiagram } from '@nautink/storage/diagrams';
import { InvalidBackupError } from '@nautink/storage/errors';
import { describe, expect, it } from 'vitest';

import { loadedWorkspace } from '../../../tests/workspace-fixtures.ts';
import { isUntouchedDiagram, isUntouchedWorkspace } from '../untouched.ts';
import { selectActiveDiagram, selectActiveStack } from '../use-workspace.ts';

describe('createDiagrams', () => {
  it('saves each draft with its own first step and opens the last', async () => {
    const workspace = await loadedWorkspace();
    const created = await workspace.store.getState().createDiagrams([
      { fields: { code: 'pie title A\n' }, step: { label: 'Imported “A”', source: 'import' } },
      {
        fields: { code: 'flowchart LR\n', title: 'B', titleAuto: false, view: 'edit' },
        step: { label: 'Imported “B”', source: 'import' },
      },
    ]);
    const state = workspace.store.getState();
    expect(state.diagrams).toHaveLength(3);
    expect(selectActiveDiagram(state)?.id).toBe(created[1]?.id);
    expect(selectActiveStack(state)?.entries[0]?.label).toBe('Imported “B”');
    expect(created[0]?.title).toBe('A');
    expect((await getDiagram(workspace.db(), created[1]?.id ?? '')).view).toBe('edit');
  });

  it('shows an error and returns nothing when saving fails', async () => {
    const workspace = await loadedWorkspace();
    workspace.db().close();
    const created = await workspace.store
      .getState()
      .createDiagrams([{ fields: { code: 'pie' }, step: { label: 'x', source: 'import' } }]);
    expect(created).toEqual([]);
    expect(workspace.error).toHaveBeenCalledWith(expect.stringMatching(/^Could not create/));
  });
});

describe('backups', () => {
  it('exports the workspace and imports it, opening the import over an untouched one', async () => {
    const source = await loadedWorkspace();
    source.store.getState().applyEdit('pie title Kept\n', { label: 'x', source: 'code' });
    const backup = await source.store.getState().exportBackup();
    expect(backup.diagrams.map((diagram) => diagram.code)).toEqual(['pie title Kept\n']);
    const target = await loadedWorkspace();
    const result = await target.store.getState().importBackup(backup);
    expect(result.diagrams).toHaveLength(1);
    const state = target.store.getState();
    expect(state.diagrams).toHaveLength(2);
    expect(selectActiveDiagram(state)?.code).toBe('pie title Kept\n');
  });

  it('keeps the open diagram when it has been worked on', async () => {
    const workspace = await loadedWorkspace();
    workspace.store
      .getState()
      .applyEdit('flowchart TD\n  a --> b\n', { label: 'x', source: 'code' });
    const before = workspace.store.getState().activeId;
    const backup = {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      diagrams: [newDiagram({ code: 'pie' })],
      versions: [],
      positions: {},
    };
    await workspace.store.getState().importBackup(backup);
    expect(workspace.store.getState().activeId).toBe(before);
  });

  it('throws for a file that is not a backup', async () => {
    const workspace = await loadedWorkspace();
    await expect(workspace.store.getState().importBackup({ hello: 1 })).rejects.toThrow(
      InvalidBackupError,
    );
  });
});

describe('untouched detection', () => {
  it('sees the first blank diagram as untouched, and any work as touched', () => {
    const blank = newDiagram({ code: 'flowchart TD\n' });
    expect(isUntouchedDiagram(blank)).toBe(true);
    expect(isUntouchedDiagram(newDiagram({ code: '' }))).toBe(true);
    expect(isUntouchedDiagram(newDiagram({ code: 'flowchart TD\n  a' }))).toBe(false);
    expect(isUntouchedDiagram({ ...blank, draft: 'hi' })).toBe(false);
    expect(isUntouchedDiagram({ ...blank, titleAuto: false })).toBe(false);
    expect(isUntouchedDiagram({ ...blank, pinned: true })).toBe(false);
    expect(isUntouchedDiagram({ ...blank, messages: [{ role: 'user', text: 'x' }] })).toBe(false);
    expect(isUntouchedWorkspace([blank])).toBe(true);
    expect(isUntouchedWorkspace([blank, blank])).toBe(false);
    expect(isUntouchedWorkspace([])).toBe(false);
  });
});
