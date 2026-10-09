import { exportAll, importAll } from '@nautink/storage/backup';
import { sortDiagrams } from '@nautink/storage/diagram-order';
import { newDiagram, putDiagrams, withAutoTitle } from '@nautink/storage/diagrams';

import { isUntouchedWorkspace } from './untouched.ts';
import { activate, addDiagrams, errorMessage, requireDb } from './workspace-context.ts';

import type { EditMeta } from './edit-history.ts';
import type { ImportActions, NewDiagramDraft, StoreContext } from './workspace-state.ts';
import type { ImportResult } from '@nautink/storage/backup';
import type { Backup } from '@nautink/storage/backup-format';
import type { Diagram } from '@nautink/storage/records';

/** The records for `drafts`, a millisecond apart so the last one sorts first (as v1). */
function buildRecords(drafts: readonly NewDiagramDraft[], now: number): Diagram[] {
  return drafts.map(({ fields }, index) =>
    withAutoTitle(newDiagram({ ...fields, createdAt: now + index, updatedAt: now + index })),
  );
}

/** Saves the drafts, adds them to the workspace and opens the last one. */
async function saveAndOpen(
  ctx: StoreContext,
  drafts: readonly NewDiagramDraft[],
): Promise<Diagram[]> {
  await ctx.runtime.autosaver.flush();
  const records: Diagram[] = buildRecords(drafts, ctx.deps.now());
  await putDiagrams(requireDb(ctx), records);
  records.forEach((record, index) => {
    addDiagrams(ctx, [record], drafts[index]?.step);
  });
  const last: Diagram | undefined = records.at(-1);
  if (last !== undefined) {
    activate(ctx, last.id);
  }
  return records;
}

function createAction(ctx: StoreContext): ImportActions['createDiagrams'] {
  return async (drafts: readonly NewDiagramDraft[]): Promise<Diagram[]> => {
    try {
      return await saveAndOpen(ctx, drafts);
    } catch (err) {
      ctx.deps.notify.error(`Could not create the diagram. ${errorMessage(err)}`);
      return [];
    }
  };
}

const IMPORT_STEP: EditMeta = { label: 'Imported from a backup', source: 'import' };

function importAction(ctx: StoreContext): ImportActions['importBackup'] {
  return async (data: unknown): Promise<ImportResult> => {
    await ctx.runtime.autosaver.flush();
    const wasUntouched: boolean = isUntouchedWorkspace(ctx.get().diagrams);
    const result: ImportResult = await importAll(requireDb(ctx), data);
    addDiagrams(ctx, result.diagrams, IMPORT_STEP);
    const [first] = sortDiagrams(result.diagrams);
    if (wasUntouched && first !== undefined) {
      activate(ctx, first.id);
    }
    return result;
  };
}

/** New diagrams from code (templates, imported files), backup import and export. */
export function importActions(ctx: StoreContext): ImportActions {
  return {
    createDiagrams: createAction(ctx),
    importBackup: importAction(ctx),
    exportBackup: async (): Promise<Backup> => {
      await ctx.runtime.autosaver.flush();
      return exportAll(requireDb(ctx));
    },
  };
}
