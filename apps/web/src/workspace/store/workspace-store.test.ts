import { openNautinkDb } from '@nautink/storage/db';
import { createDiagram, getDiagram } from '@nautink/storage/diagrams';
import { addVersion, listVersions } from '@nautink/storage/versions';
import { waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { createTestWorkspace, loadedWorkspace } from '../../../tests/workspace-fixtures.ts';
import { pickActiveId } from '../actions/load-action.ts';
import { BLANK_FLOWCHART } from '../blank-diagram.ts';
import { currentEntry, TYPING_GROUP } from '../undo/edit-history.ts';
import { registerHistoryGuard } from '../undo/history-guard.ts';
import { selectActiveDiagram, selectActiveStack } from '../use-workspace.ts';

import type { TestWorkspace } from '../../../tests/workspace-fixtures.ts';
import type { Diagram } from '@nautink/storage/records';

const active = (workspace: TestWorkspace): Diagram => {
  const diagram = selectActiveDiagram(workspace.store.getState());
  if (diagram === undefined) {
    throw new Error('No active diagram');
  }
  return diagram;
};

const stackLabels = (workspace: TestWorkspace): string[] =>
  selectActiveStack(workspace.store.getState())?.entries.map((entry) => entry.label) ?? [];

/** A workspace whose database already holds two diagrams, B the most recent. */
async function seededWorkspace(): Promise<TestWorkspace & { first: Diagram; second: Diagram }> {
  const workspace = createTestWorkspace();
  const db = await openNautinkDb(workspace.dbName);
  const first = await createDiagram(db, {
    title: 'A',
    titleAuto: false,
    updatedAt: 1,
    code: 'pie',
  });
  const second = await createDiagram(db, { title: 'B', titleAuto: false, updatedAt: 2 });
  db.close();
  return { ...workspace, first, second };
}

describe('load', () => {
  it('creates and opens a blank flowchart on first run', async () => {
    const workspace = await loadedWorkspace();
    const { status, diagrams, activeId } = workspace.store.getState();
    expect(status).toBe('ready');
    expect(diagrams).toHaveLength(1);
    expect(active(workspace).code).toBe(BLANK_FLOWCHART);
    expect(workspace.remembered.id).toBe(activeId);
    expect(stackLabels(workspace)).toEqual(['New blank flowchart']);
  });

  it('opens the remembered diagram, or the first in list order when it is gone', () => {
    expect(pickActiveId([{ id: 'a' }, { id: 'b' }] as Diagram[], 'b')).toBe('b');
    expect(pickActiveId([{ id: 'a' }, { id: 'b' }] as Diagram[], 'gone')).toBe('a');
    expect(pickActiveId([{ id: 'a' }] as Diagram[], null)).toBe('a');
    expect(() => pickActiveId([], null)).toThrow('no diagram');
  });

  it('loads saved diagrams, opening the most recent', async () => {
    const workspace = await seededWorkspace();
    await workspace.store.getState().load();
    expect(workspace.store.getState().diagrams).toHaveLength(2);
    expect(stackLabels(workspace)).toEqual(['Opened']);
  });

  it('runs once, and reports a failure that a retry can recover from', async () => {
    let attempts = 0;
    const workspace = createTestWorkspace({
      openDb: async () => {
        attempts += 1;
        await Promise.resolve();
        throw new Error('blocked');
      },
    });
    await workspace.store.getState().load();
    expect(workspace.store.getState()).toMatchObject({ status: 'error', loadError: 'blocked' });
    expect(workspace.error).toHaveBeenCalledWith('Could not open the diagram database. blocked');
    await workspace.store.getState().load();
    expect(attempts).toBe(2);
    const ready = await loadedWorkspace();
    await ready.store.getState().load();
    expect(ready.store.getState().diagrams).toHaveLength(1);
  });

  it('ignores a load that finishes after a reset', async () => {
    const workspace = createTestWorkspace();
    const loading = workspace.store.getState().load();
    workspace.store.getState().reset();
    await loading;
    expect(workspace.store.getState()).toMatchObject({ status: 'idle', diagrams: [] });
  });
});

describe('library actions', () => {
  it('creates a diagram and opens it', async () => {
    const workspace = await loadedWorkspace();
    const firstId = workspace.store.getState().activeId;
    await workspace.store.getState().createDiagram();
    expect(workspace.store.getState().diagrams).toHaveLength(2);
    expect(workspace.store.getState().activeId).not.toBe(firstId);
    expect(workspace.remembered.id).toBe(workspace.store.getState().activeId);
  });

  it('switches diagrams, ending the typing group of the one left', async () => {
    const workspace = await seededWorkspace();
    await workspace.store.getState().load();
    const { selectDiagram, applyEdit } = workspace.store.getState();
    selectDiagram(workspace.second.id);
    applyEdit('flowchart LR\n', { label: 'Typed in code', source: 'code', group: TYPING_GROUP });
    selectDiagram(workspace.second.id);
    selectDiagram(workspace.first.id);
    expect(active(workspace).title).toBe('A');
    const left = workspace.store.getState().histories[workspace.second.id];
    expect(left === undefined ? undefined : currentEntry(left).isOpen).toBe(false);
    expect(workspace.remembered.id).toBe(workspace.first.id);
  });

  it('renames, pins and unpins, saving each at once', async () => {
    const workspace = await loadedWorkspace();
    const { id, updatedAt } = active(workspace);
    workspace.clock.now += 500;
    workspace.store.getState().renameDiagram(id, '  Checkout flow ');
    expect(active(workspace)).toMatchObject({ title: 'Checkout flow', titleAuto: false });
    expect(active(workspace).updatedAt).toBe(updatedAt + 500);
    workspace.store.getState().togglePin(id);
    expect(active(workspace).pinned).toBe(true);
    await workspace.store.getState().flushSaves();
    expect(await getDiagram(workspace.db(), id)).toMatchObject({
      title: 'Checkout flow',
      pinned: true,
      updatedAt: updatedAt + 500,
    });
    expect(() => {
      workspace.store.getState().renameDiagram(id, '  ');
    }).toThrow('cannot be blank');
  });

  it('duplicates and opens the copy, with a notice', async () => {
    const workspace = await loadedWorkspace();
    const { id } = active(workspace);
    workspace.store.getState().renameDiagram(id, 'Checkout');
    await workspace.store.getState().duplicateDiagram(id);
    expect(active(workspace).title).toBe('Checkout copy');
    expect(stackLabels(workspace)).toEqual(['Duplicated “Checkout”']);
    expect(workspace.info).toHaveBeenCalledWith('Duplicated as “Checkout copy”');
  });

  it('reports a duplicate that fails', async () => {
    const workspace = await loadedWorkspace();
    await workspace.store.getState().duplicateDiagram('missing');
    expect(workspace.error).toHaveBeenCalledWith(
      'Could not duplicate the diagram. No diagram with id "missing" in the workspace.',
    );
  });

  it('downloads the code as a .mmd file named after the title', async () => {
    const workspace = await loadedWorkspace();
    const { id } = active(workspace);
    workspace.store.getState().renameDiagram(id, 'Checkout flow');
    workspace.store.getState().downloadDiagram(id);
    expect(workspace.download).toHaveBeenCalledWith({
      fileName: 'Checkout-flow.mmd',
      text: BLANK_FLOWCHART,
    });
  });
});

describe('delete and undo', () => {
  it('deletes the open diagram with its versions, opens the next, and undoes it', async () => {
    const workspace = await seededWorkspace();
    await workspace.store.getState().load();
    workspace.store.getState().selectDiagram(workspace.second.id);
    await addVersion(workspace.db(), { diagramId: workspace.second.id, code: 'x', kind: 'manual' });
    await workspace.store.getState().deleteDiagram(workspace.second.id);
    expect(workspace.store.getState().diagrams.map((d) => d.id)).not.toContain(workspace.second.id);
    expect(workspace.store.getState().activeId).not.toBe(workspace.second.id);
    expect(workspace.info).toHaveBeenCalledWith('Deleted “B”', expect.anything());
    const action = workspace.info.mock.calls[0]?.[1];
    action?.run();
    await waitFor(() => {
      expect(workspace.store.getState().activeId).toBe(workspace.second.id);
    });
    expect(await listVersions(workspace.db(), workspace.second.id)).toHaveLength(1);
  });

  it('keeps the open diagram when another is deleted and restored', async () => {
    const workspace = await seededWorkspace();
    await workspace.store.getState().load();
    workspace.store.getState().selectDiagram(workspace.second.id);
    await workspace.store.getState().deleteDiagram(workspace.first.id);
    expect(workspace.store.getState().activeId).toBe(workspace.second.id);
    workspace.info.mock.calls[0]?.[1]?.run();
    await waitFor(() => {
      expect(workspace.store.getState().diagrams).toHaveLength(2);
    });
    expect(workspace.store.getState().activeId).toBe(workspace.second.id);
  });

  it('creates a blank diagram when the last one is deleted', async () => {
    const workspace = await loadedWorkspace();
    const { id } = active(workspace);
    await workspace.store.getState().deleteDiagram(id);
    expect(workspace.store.getState().diagrams).toHaveLength(1);
    expect(active(workspace).id).not.toBe(id);
  });

  it('reports a delete or restore that fails', async () => {
    const workspace = await loadedWorkspace();
    await workspace.store.getState().deleteDiagram('missing');
    expect(workspace.error).toHaveBeenLastCalledWith(
      expect.stringMatching(/^Could not delete the diagram\./),
    );
    workspace.db().close();
    await workspace.store
      .getState()
      .restoreDiagram({ diagram: active(workspace), versions: [], positions: {} }, true);
    expect(workspace.error).toHaveBeenLastCalledWith(
      expect.stringMatching(/^Could not restore the diagram\./),
    );
  });

  it('reports a create that fails', async () => {
    const workspace = await loadedWorkspace();
    workspace.db().close();
    await workspace.store.getState().createDiagram();
    expect(workspace.error).toHaveBeenLastCalledWith(
      expect.stringMatching(/^Could not create a diagram\./),
    );
  });
});

describe('autosave', () => {
  it('writes code after the delay, going from saving to saved', async () => {
    const workspace = await loadedWorkspace();
    const { id } = active(workspace);
    workspace.store
      .getState()
      .applyEdit('flowchart LR\n', { label: 'Pasted code', source: 'code' });
    expect(workspace.store.getState().saveState).toBe('saving');
    await waitFor(() => {
      expect(workspace.store.getState().saveState).toBe('saved');
    });
    expect((await getDiagram(workspace.db(), id)).code).toBe('flowchart LR\n');
  });

  it('flushes at once, and saves chat, session, draft and view', async () => {
    const workspace = await loadedWorkspace();
    const { id, updatedAt } = active(workspace);
    const state = workspace.store.getState();
    state.setDraft(id, 'add a retry');
    state.setView(id, 'split');
    state.setSessionId(id, 'session-1');
    expect(active(workspace).updatedAt).toBe(updatedAt);
    workspace.clock.now += 10;
    state.updateMessages(id, (messages) => [...messages, { role: 'user', text: 'Draw a login' }]);
    await state.flushSaves();
    expect(await getDiagram(workspace.db(), id)).toMatchObject({
      draft: 'add a retry',
      view: 'split',
      sessionId: 'session-1',
      title: 'Draw a login',
      updatedAt: updatedAt + 10,
    });
    expect(workspace.store.getState().saveState).toBe('saved');
  });

  it('reports a failed save and retries it on the next flush', async () => {
    const workspace = await loadedWorkspace();
    const { id } = active(workspace);
    const db = workspace.db();
    const spy = vi.spyOn(db, 'transaction').mockImplementationOnce(() => {
      throw new Error('disk full');
    });
    workspace.store.getState().setDraft(id, 'hello');
    await workspace.store.getState().flushSaves();
    expect(workspace.store.getState().saveState).toBe('error');
    expect(workspace.error).toHaveBeenCalledWith('Could not save. disk full');
    spy.mockRestore();
    await workspace.store.getState().flushSaves();
    expect(workspace.store.getState().saveState).toBe('saved');
    expect((await getDiagram(db, id)).draft).toBe('hello');
  });

  it('drops a change to a diagram that no longer exists', async () => {
    const workspace = await loadedWorkspace();
    const { id } = active(workspace);
    await workspace.db().delete('diagrams', id);
    workspace.store.getState().setDraft(id, 'lost');
    await workspace.store.getState().flushSaves();
    expect(workspace.error).toHaveBeenCalledWith(`Could not save. No diagram with id "${id}".`);
    await workspace.store.getState().flushSaves();
    expect(workspace.error).toHaveBeenCalledTimes(1);
  });
});

describe('edit actions', () => {
  const typed = { label: 'Typed in code', source: 'code', group: TYPING_GROUP } as const;

  it('groups typing, undoes and redoes through the history, and saves each move', async () => {
    const workspace = await loadedWorkspace();
    const { applyEdit, undo, redo, flushSaves } = workspace.store.getState();
    applyEdit('flowchart TD\nA', typed);
    workspace.clock.now += 100;
    applyEdit('flowchart TD\nAB', typed);
    expect(stackLabels(workspace)).toEqual(['New blank flowchart', 'Typed in code']);
    undo();
    expect(active(workspace).code).toBe(BLANK_FLOWCHART);
    undo();
    redo();
    expect(active(workspace).code).toBe('flowchart TD\nAB');
    redo();
    await flushSaves();
    expect((await getDiagram(workspace.db(), active(workspace).id)).code).toBe('flowchart TD\nAB');
  });

  it('lets a history guard take over undo, and holds redo and jumps meanwhile', async () => {
    const workspace = await loadedWorkspace();
    const { applyEdit, undo, redo, jumpTo } = workspace.store.getState();
    applyEdit('flowchart TD\nA', { label: 'Pasted code', source: 'code' });
    undo();
    const runInstead = vi.fn();
    const unregister = registerHistoryGuard({
      undoInstead: () => 'Reject it',
      runInstead,
      subscribe: () => (): void => undefined,
    });
    redo();
    jumpTo(1);
    expect(active(workspace).code).toBe(BLANK_FLOWCHART);
    undo();
    expect(runInstead).toHaveBeenCalledWith(active(workspace).id);
    unregister();
    redo();
    expect(active(workspace).code).toBe('flowchart TD\nA');
  });

  it('closes the typing group on request', async () => {
    const workspace = await loadedWorkspace();
    const { applyEdit, closeEditGroup } = workspace.store.getState();
    applyEdit('a', typed);
    closeEditGroup();
    applyEdit('ab', typed);
    expect(stackLabels(workspace)).toHaveLength(3);
  });

  it('announces jumps across a Claude turn', async () => {
    const workspace = await loadedWorkspace();
    const { applyEdit, jumpTo, undo } = workspace.store.getState();
    applyEdit('pie', { label: 'Claude: Make it a pie', source: 'claude' });
    applyEdit('pie\n', { label: 'Typed in code', source: 'code' });
    jumpTo(0);
    expect(workspace.info).toHaveBeenLastCalledWith(
      'Undid 2 steps, including “Claude: Make it a pie”',
    );
    jumpTo(1);
    expect(workspace.info).toHaveBeenLastCalledWith('Redid “Claude: Make it a pie”');
    jumpTo(1);
    workspace.store.getState().redo();
    undo();
    expect(workspace.info).toHaveBeenCalledTimes(2);
  });

  it('edits a background diagram by id, and amends a Claude turn', async () => {
    const workspace = await seededWorkspace();
    await workspace.store.getState().load();
    const { applyEdit, amendEdit } = workspace.store.getState();
    applyEdit('pie title Pets', {
      label: 'Claude: Title',
      source: 'claude',
      diagramId: workspace.first.id,
    });
    expect(workspace.store.getState().diagrams.find((d) => d.id === workspace.first.id)?.code).toBe(
      'pie title Pets',
    );
    const entry = applyEdit('erDiagram', { label: 'Claude: ER', source: 'claude' });
    expect(amendEdit(entry.id, 'erDiagram\n')).toBe(true);
    expect(active(workspace).code).toBe('erDiagram\n');
    expect(amendEdit(entry.id - 1, 'x')).toBe(false);
    expect(amendEdit(entry.id, 'erDiagram\n')).toBe(true);
  });

  it('does nothing before load, and refuses an edit with no open diagram', () => {
    const workspace = createTestWorkspace();
    const { undo, redo, closeEditGroup, applyEdit } = workspace.store.getState();
    undo();
    redo();
    closeEditGroup();
    expect(() => applyEdit('x', typed)).toThrow('No diagram is open.');
  });
});

describe('panel requests', () => {
  it('starts and ends a rename, and asks for search focus', async () => {
    const workspace = await loadedWorkspace();
    const { startRename, endRename, requestSearchFocus, takeSearchFocusRequest } =
      workspace.store.getState();
    startRename(active(workspace).id);
    expect(workspace.store.getState().renamingId).toBe(active(workspace).id);
    endRename();
    expect(workspace.store.getState().renamingId).toBeNull();
    expect(() => {
      startRename('missing');
    }).toThrow('No diagram with id "missing"');
    requestSearchFocus();
    expect(workspace.store.getState().isSearchFocusRequested).toBe(true);
    takeSearchFocusRequest();
    expect(workspace.store.getState().isSearchFocusRequested).toBe(false);
  });
});
