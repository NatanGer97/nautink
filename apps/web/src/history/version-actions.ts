import {
  addVersion,
  deleteVersion,
  listVersions,
  putVersion,
  renameVersion,
} from '@nautink/storage/versions';

import { versionText } from './version-text.ts';
import { announceVersionsChanged } from './versions-store.ts';
import { viewVersion } from './viewed-version.ts';
import { showError, showNotice } from '../lib/notices.ts';
import { errorMessage } from '../workspace/store/workspace-context.ts';
import { clip } from '../workspace/text.ts';
import { selectActiveDiagram, useWorkspaceStore } from '../workspace/use-workspace.ts';

import type { WorkspaceState } from '../workspace/store/workspace-state.ts';
import type { Diagram, Version } from '@nautink/storage/records';
import type { AddVersionResult, NewVersion } from '@nautink/storage/versions';

/** Version names in step labels are cut so the step menu stays one line. */
const LABEL_TEXT_LENGTH: number = 40;

/** The open diagram. Throws before the workspace has loaded. */
function requireActive(workspace: WorkspaceState): Diagram {
  const diagram: Diagram | undefined = selectActiveDiagram(workspace);
  if (diagram === undefined) {
    throw new Error('No diagram is open.');
  }
  return diagram;
}

async function runOrNotify(failure: string, task: () => Promise<void>): Promise<void> {
  try {
    await task();
  } catch (err) {
    showError(`${failure}. ${errorMessage(err)}`);
  }
}

/** Same code as the latest version: a name goes on that version instead. */
async function nameLatest(diagram: Diagram, label: string): Promise<void> {
  const workspace: WorkspaceState = useWorkspaceStore.getState();
  const [latest] = await listVersions(workspace.requireDb(), diagram.id);
  if (label === '' || latest === undefined) {
    showNotice('No changes since the last version');
    return;
  }
  await renameVersion(workspace.requireDb(), latest.id, label);
  showNotice(`Named the latest version “${label}”`);
}

/** Snapshots the open diagram's code; tells the user when there was nothing new to keep. */
async function snapshotManual(diagram: Diagram, name: string): Promise<void> {
  const workspace: WorkspaceState = useWorkspaceStore.getState();
  await workspace.flushSaves();
  const input: NewVersion = {
    diagramId: diagram.id,
    code: diagram.code,
    kind: 'manual',
    label: name,
  };
  const result: AddVersionResult = await addVersion(workspace.requireDb(), input);
  if (result.status === 'added') {
    showNotice(name === '' ? 'Saved a version' : `Saved version “${name}”`);
  } else {
    await nameLatest(diagram, name);
  }
  announceVersionsChanged(diagram.id);
}

/** ⌘S: saves the open diagram's code as a `manual` version, named when `label` is not blank. */
export async function saveManualVersion(label: string): Promise<void> {
  await runOrNotify('Could not save the version', async () => {
    const diagram: Diagram = requireActive(useWorkspaceStore.getState());
    if (diagram.code.trim() === '') {
      showNotice('Nothing to save yet');
      return;
    }
    await snapshotManual(diagram, label.trim());
  });
}

/** Keeps the current code as a "Before restore" version, then loads `version` as one step. */
async function loadVersionCode(diagram: Diagram, version: Version): Promise<void> {
  const workspace: WorkspaceState = useWorkspaceStore.getState();
  await workspace.flushSaves();
  const before: NewVersion = { diagramId: diagram.id, code: diagram.code, kind: 'restore' };
  await addVersion(workspace.requireDb(), before);
  const label: string = `Restored “${clip(versionText(version), LABEL_TEXT_LENGTH)}”`;
  workspace.applyEdit(version.code, { label, source: 'restore', diagramId: diagram.id });
}

/** Undo for the restore notice: only while the restored diagram is still the open one. */
function undoIn(diagramId: string): void {
  const workspace: WorkspaceState = useWorkspaceStore.getState();
  if (workspace.activeId === diagramId) {
    workspace.undo();
  }
}

/**
 * Loads `version` into the open diagram as one undoable step. The current code is kept first as a
 * "Before restore" version, so nothing is lost (as v1).
 */
export async function restoreVersion(version: Version): Promise<void> {
  await runOrNotify('Could not restore the version', async () => {
    const diagram: Diagram = requireActive(useWorkspaceStore.getState());
    if (version.code === diagram.code) {
      showNotice('That is already the current code');
      return;
    }
    await loadVersionCode(diagram, version);
    viewVersion(null);
    announceVersionsChanged(diagram.id);
    showNotice('Restored the version', {
      label: 'Undo',
      run: () => {
        undoIn(diagram.id);
      },
    });
  });
}

/** Names a version; an empty name makes it unnamed again. */
export async function renameVersionLabel(version: Version, label: string): Promise<void> {
  await runOrNotify('Could not rename the version', async () => {
    const renamed: Version = await renameVersion(
      useWorkspaceStore.getState().requireDb(),
      version.id,
      label.trim(),
    );
    viewVersion(renamed);
    announceVersionsChanged(version.diagramId);
  });
}

/** Deletes a version, with an Undo notice that puts it back. */
export async function deleteVersionWithUndo(version: Version): Promise<void> {
  await runOrNotify('Could not delete the version', async () => {
    await deleteVersion(useWorkspaceStore.getState().requireDb(), version.id);
    viewVersion(null);
    announceVersionsChanged(version.diagramId);
    showNotice('Deleted the version', {
      label: 'Undo',
      run: () => {
        void runOrNotify('Could not put the version back', async () => {
          await putVersion(useWorkspaceStore.getState().requireDb(), version);
          announceVersionsChanged(version.diagramId);
        });
      },
    });
  });
}
