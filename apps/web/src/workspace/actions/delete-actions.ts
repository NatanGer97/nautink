import { deleteDiagram, restoreDiagram } from '@nautink/storage/diagram-delete';
import { sortDiagrams } from '@nautink/storage/diagram-order';

import { createBlankDiagram } from './library-actions.ts';
import {
  activate,
  addDiagrams,
  findDiagram,
  requireDb,
  runSafely,
} from '../store/workspace-context.ts';
import { displayTitle } from '../text.ts';

import type { LibraryActions, StoreContext } from '../store/workspace-state.ts';
import type { DeletedDiagram } from '@nautink/storage/diagram-delete';
import type { Diagram } from '@nautink/storage/records';

/** After the open diagram is deleted: the next in list order, or a new blank one. */
async function openNext(ctx: StoreContext): Promise<void> {
  const [next] = sortDiagrams(ctx.get().diagrams);
  if (next === undefined) {
    await createBlankDiagram(ctx);
    return;
  }
  activate(ctx, next.id);
}

function deleteAction(ctx: StoreContext): LibraryActions['deleteDiagram'] {
  return async (id: string): Promise<void> => {
    await runSafely(ctx, 'Could not delete the diagram', async () => {
      const diagram: Diagram = findDiagram(ctx.get(), id);
      await ctx.runtime.autosaver.flush();
      const deleted: DeletedDiagram = await deleteDiagram(requireDb(ctx), id);
      ctx.runtime.autosaver.drop(id);
      const wasActive: boolean = ctx.get().activeId === id;
      ctx.set((state) => ({ diagrams: state.diagrams.filter((item) => item.id !== id) }));
      if (wasActive) {
        await openNext(ctx);
      }
      ctx.deps.notify.info(`Deleted “${displayTitle(diagram.title)}”`, {
        label: 'Undo',
        run: () => void ctx.get().restoreDiagram(deleted, wasActive),
      });
    });
  };
}

function restoreAction(ctx: StoreContext): LibraryActions['restoreDiagram'] {
  return async (deleted: DeletedDiagram, shouldOpen: boolean): Promise<void> => {
    await runSafely(ctx, 'Could not restore the diagram', async () => {
      await restoreDiagram(requireDb(ctx), deleted);
      addDiagrams(ctx, [deleted.diagram]);
      if (shouldOpen) {
        activate(ctx, deleted.diagram.id);
      }
    });
  };
}

/** Delete with an Undo notice, and the restore it runs. */
export function deleteActions(
  ctx: StoreContext,
): Pick<LibraryActions, 'deleteDiagram' | 'restoreDiagram'> {
  return { deleteDiagram: deleteAction(ctx), restoreDiagram: restoreAction(ctx) };
}
