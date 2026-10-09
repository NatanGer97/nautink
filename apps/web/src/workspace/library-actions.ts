import { fileSlug } from '@nautink/storage/diagram-files';
import { createDiagram, duplicateDiagram } from '@nautink/storage/diagrams';

import { blankDiagramFields, NEW_DIAGRAM_STEP } from './blank-diagram.ts';
import { clip, displayTitle } from './text.ts';
import {
  activate,
  addDiagrams,
  applyPatch,
  findDiagram,
  requireDb,
  runSafely,
} from './workspace-context.ts';

import type { LibraryActions, StoreContext } from './workspace-state.ts';
import type { Diagram } from '@nautink/storage/records';

/** Long titles are cut in history labels so the step menu stays one line. */
const LABEL_TITLE_LENGTH: number = 30;

/** Saves a new blank diagram and opens it. */
export async function createBlankDiagram(ctx: StoreContext): Promise<void> {
  const diagram: Diagram = await createDiagram(requireDb(ctx), blankDiagramFields(ctx.deps.now()));
  addDiagrams(ctx, [diagram], NEW_DIAGRAM_STEP);
  activate(ctx, diagram.id);
}

function selectAction(ctx: StoreContext): LibraryActions['selectDiagram'] {
  return (id: string): void => {
    if (id === ctx.get().activeId) {
      return;
    }
    activate(ctx, id);
    void ctx.runtime.autosaver.flush();
  };
}

function renameAction(ctx: StoreContext): LibraryActions['renameDiagram'] {
  return (id: string, title: string): void => {
    const trimmed: string = title.trim();
    if (trimmed === '') {
      throw new Error('A diagram title cannot be blank.');
    }
    applyPatch(ctx, id, { title: trimmed, titleAuto: false });
    void ctx.runtime.autosaver.flush();
  };
}

function togglePinAction(ctx: StoreContext): LibraryActions['togglePin'] {
  return (id: string): void => {
    applyPatch(ctx, id, { pinned: !findDiagram(ctx.get(), id).pinned });
    void ctx.runtime.autosaver.flush();
  };
}

function duplicateAction(ctx: StoreContext): LibraryActions['duplicateDiagram'] {
  return async (id: string): Promise<void> => {
    await runSafely(ctx, 'Could not duplicate the diagram', async () => {
      const source: Diagram = findDiagram(ctx.get(), id);
      await ctx.runtime.autosaver.flush();
      const copy: Diagram = await duplicateDiagram(requireDb(ctx), id);
      const label: string = `Duplicated “${clip(displayTitle(source.title), LABEL_TITLE_LENGTH)}”`;
      addDiagrams(ctx, [copy], { label, source: 'duplicate' });
      activate(ctx, copy.id);
      ctx.deps.notify.info(`Duplicated as “${copy.title}”`);
    });
  };
}

function downloadAction(ctx: StoreContext): LibraryActions['downloadDiagram'] {
  return (id: string): void => {
    const diagram: Diagram = findDiagram(ctx.get(), id);
    ctx.deps.download({ fileName: `${fileSlug(diagram.title)}.mmd`, text: diagram.code });
  };
}

/** Create, select, rename, pin, duplicate and download. */
export function libraryActions(
  ctx: StoreContext,
): Omit<LibraryActions, 'load' | 'deleteDiagram' | 'restoreDiagram'> {
  return {
    createDiagram: async (): Promise<void> => {
      await runSafely(ctx, 'Could not create a diagram', async () => {
        await ctx.runtime.autosaver.flush();
        await createBlankDiagram(ctx);
      });
    },
    selectDiagram: selectAction(ctx),
    renameDiagram: renameAction(ctx),
    togglePin: togglePinAction(ctx),
    duplicateDiagram: duplicateAction(ctx),
    downloadDiagram: downloadAction(ctx),
  };
}
