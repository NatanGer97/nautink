import { isContentChange, withAutoTitle } from '@nautink/storage/diagrams';

import { EXTERNAL_STEP, OPENED_STEP } from '../blank-diagram.ts';
import { closeEditGroup, createEditStack, currentEntry, recordEdit } from '../undo/edit-history.ts';

import type { StoreContext, WorkspaceData } from './workspace-state.ts';
import type { EditMeta, EditStack } from '../undo/edit-history.ts';
import type { NautinkDb } from '@nautink/storage/db';
import type { DiagramPatch } from '@nautink/storage/diagrams';
import type { Diagram } from '@nautink/storage/records';

/** The open database. Throws before `load` has finished. */
export function requireDb(ctx: StoreContext): NautinkDb {
  return ctx.runtime.requireDb();
}

/** The diagram with this id. Throws when the workspace has none. */
export function findDiagram(state: WorkspaceData, id: string): Diagram {
  const diagram: Diagram | undefined = state.diagrams.find((item) => item.id === id);
  if (diagram === undefined) {
    throw new Error(`No diagram with id "${id}" in the workspace.`);
  }
  return diagram;
}

/** The message of anything thrown, for a notice. */
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Runs `task`; a failure becomes an error notice that starts with `failure`. */
export async function runSafely(
  ctx: StoreContext,
  failure: string,
  task: () => Promise<void>,
): Promise<void> {
  try {
    await task();
  } catch (err) {
    ctx.deps.notify.error(`${failure}. ${errorMessage(err)}`);
  }
}

/**
 * Merges `patch` into the diagram in memory, the way `updateDiagram` will in storage (automatic
 * title, `updatedAt` on content changes), and queues the save. `updatedAt` goes into the saved
 * patch so memory and storage agree.
 */
export function applyPatch(ctx: StoreContext, id: string, patch: DiagramPatch): Diagram {
  const current: Diagram = findDiagram(ctx.get(), id);
  const touched: DiagramPatch = isContentChange(current, patch)
    ? { updatedAt: ctx.deps.now() }
    : {};
  const next: Diagram = withAutoTitle({ ...current, ...touched, ...patch, id });
  ctx.set((state) => ({
    diagrams: state.diagrams.map((diagram) => (diagram.id === id ? next : diagram)),
  }));
  ctx.runtime.autosaver.schedule(id, { ...patch, ...touched });
  return next;
}

/** Stores the edit stack of a diagram. */
export function setStack(ctx: StoreContext, id: string, stack: EditStack): void {
  ctx.set((state) => ({ histories: { ...state.histories, [id]: stack } }));
}

/** The stack for a diagram whose code is `code`: created, or caught up with an outside change. */
export function ensureStack(
  stack: EditStack | undefined,
  { code, now, meta = OPENED_STEP }: { code: string; now: number; meta?: EditMeta },
): EditStack {
  if (stack === undefined) {
    return createEditStack(code, meta, now);
  }
  if (currentEntry(stack).code === code) {
    return stack;
  }
  return recordEdit(stack, code, { meta: EXTERNAL_STEP, options: { now } });
}

/** Adds diagrams to the workspace with a fresh edit history that starts at `step`. */
export function addDiagrams(
  ctx: StoreContext,
  diagrams: readonly Diagram[],
  step: EditMeta = OPENED_STEP,
): void {
  const now: number = ctx.deps.now();
  const ids: Set<string> = new Set<string>(diagrams.map((diagram) => diagram.id));
  ctx.set((state) => ({
    diagrams: [...state.diagrams.filter((diagram) => !ids.has(diagram.id)), ...diagrams],
    histories: {
      ...state.histories,
      ...Object.fromEntries(
        diagrams.map((diagram) => [
          diagram.id,
          ensureStack(state.histories[diagram.id], { code: diagram.code, now, meta: step }),
        ]),
      ),
    },
  }));
}

/** Opens a diagram: ends the typing group of the one being left and remembers the new id. */
export function activate(ctx: StoreContext, id: string): void {
  const state: WorkspaceData = ctx.get();
  const diagram: Diagram = findDiagram(state, id);
  const histories: Record<string, EditStack> = { ...state.histories };
  const leaving: EditStack | undefined =
    state.activeId === null ? undefined : histories[state.activeId];
  if (state.activeId !== null && leaving !== undefined) {
    histories[state.activeId] = closeEditGroup(leaving);
  }
  histories[id] = ensureStack(histories[id], { code: diagram.code, now: ctx.deps.now() });
  ctx.set({ activeId: id, histories });
  ctx.deps.activeIdStorage.write(id);
}
