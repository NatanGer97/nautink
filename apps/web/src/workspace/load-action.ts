import { createDiagram, listDiagrams } from '@nautink/storage/diagrams';

import { blankDiagramFields, NEW_DIAGRAM_STEP, OPENED_STEP } from './blank-diagram.ts';
import { activate, addDiagrams, errorMessage } from './workspace-context.ts';

import type { LibraryActions, StoreContext } from './workspace-state.ts';
import type { NautinkDb } from '@nautink/storage/db';
import type { Diagram } from '@nautink/storage/records';

/** The remembered diagram if it still exists, else the first in list order. */
export function pickActiveId(diagrams: readonly Diagram[], remembered: string | null): string {
  const [first] = diagrams;
  if (first === undefined) {
    throw new Error('There is no diagram to open.');
  }
  return diagrams.some((diagram) => diagram.id === remembered) && remembered !== null
    ? remembered
    : first.id;
}

async function openWorkspace(ctx: StoreContext): Promise<void> {
  const generation: number = ctx.runtime.generation;
  const db: NautinkDb = await ctx.deps.openDb();
  if (generation !== ctx.runtime.generation) {
    db.close();
    return;
  }
  ctx.runtime.connect(db);
  const saved: Diagram[] = await listDiagrams(db);
  const isFirstRun: boolean = saved.length === 0;
  const diagrams: Diagram[] = isFirstRun
    ? [await createDiagram(db, blankDiagramFields(ctx.deps.now()))]
    : saved;
  addDiagrams(ctx, diagrams, isFirstRun ? NEW_DIAGRAM_STEP : OPENED_STEP);
  ctx.set({ status: 'ready', loadError: null });
  activate(ctx, pickActiveId(diagrams, ctx.deps.activeIdStorage.read()));
}

/** `load`: runs once, and again after a failure (a "Try again" button). */
export function loadAction(ctx: StoreContext): LibraryActions['load'] {
  return async (): Promise<void> => {
    const { status } = ctx.get();
    if (status === 'loading' || status === 'ready') {
      return;
    }
    ctx.set({ status: 'loading', loadError: null });
    try {
      await openWorkspace(ctx);
    } catch (err) {
      ctx.set({ status: 'error', loadError: errorMessage(err) });
      ctx.deps.notify.error(`Could not open the diagram database. ${errorMessage(err)}`);
    }
  };
}
