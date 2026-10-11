import { applyPatch, ensureStack, findDiagram, setStack } from '../store/workspace-context.ts';
import { clip } from '../text.ts';
import {
  amendEdit,
  canAmend,
  closeEditGroup,
  currentEntry,
  jumpEdit,
  recordEdit,
} from '../undo/edit-history.ts';
import { historyOverride, runHistoryOverride } from '../undo/history-guard.ts';

import type { EditActions, EditRequest, StoreContext } from '../store/workspace-state.ts';
import type { EditEntry, EditJump, EditStack } from '../undo/edit-history.ts';
import type { Diagram } from '@nautink/storage/records';

const ANNOUNCED_LABEL_LENGTH: number = 60;
const ANNOUNCED_MANY_LABEL_LENGTH: number = 44;

/** The open diagram's id. Throws when no diagram is open. */
function requireActiveId(ctx: StoreContext): string {
  const { activeId } = ctx.get();
  if (activeId === null) {
    throw new Error('No diagram is open.');
  }
  return activeId;
}

/** The diagram and its stack, caught up with its current code. */
function stackOf(ctx: StoreContext, id: string): { diagram: Diagram; stack: EditStack } {
  const diagram: Diagram = findDiagram(ctx.get(), id);
  const stack: EditStack = ensureStack(ctx.get().histories[id], {
    code: diagram.code,
    now: ctx.deps.now(),
  });
  return { diagram, stack };
}

/** Big jumps (a Claude turn, a restore) get a notice, so an undo of one is never silent. */
export function jumpNotice(jump: EditJump): string | undefined {
  const big: EditEntry | undefined = jump.crossed.find(
    (entry) => entry.source === 'claude' || entry.source === 'restore',
  );
  if (big === undefined) {
    return undefined;
  }
  const verb: string = jump.direction === 'undo' ? 'Undid' : 'Redid';
  const count: number = jump.crossed.length;
  return count === 1
    ? `${verb} “${clip(big.label, ANNOUNCED_LABEL_LENGTH)}”`
    : `${verb} ${String(count)} steps, including “${clip(big.label, ANNOUNCED_MANY_LABEL_LENGTH)}”`;
}

function moveTo(ctx: StoreContext, target: (stack: EditStack) => number | undefined): void {
  const { activeId } = ctx.get();
  if (activeId === null) {
    return;
  }
  const { diagram, stack } = stackOf(ctx, activeId);
  const index: number | undefined = target(stack);
  if (index === undefined) {
    return;
  }
  const jump: EditJump = jumpEdit(stack, index);
  setStack(ctx, activeId, jump.stack);
  if (jump.code !== diagram.code) {
    applyPatch(ctx, activeId, { code: jump.code });
  }
  const notice: string | undefined = jumpNotice(jump);
  if (notice !== undefined) {
    ctx.deps.notify.info(notice);
  }
}

function applyEditAction(ctx: StoreContext): EditActions['applyEdit'] {
  return (code: string, { diagramId, ...meta }: EditRequest): EditEntry => {
    const id: string = diagramId ?? requireActiveId(ctx);
    const { diagram, stack } = stackOf(ctx, id);
    const next: EditStack = recordEdit(stack, code, { meta, options: { now: ctx.deps.now() } });
    setStack(ctx, id, next);
    if (diagram.code !== code) {
      applyPatch(ctx, id, { code });
    }
    return currentEntry(next);
  };
}

function amendEditAction(ctx: StoreContext): EditActions['amendEdit'] {
  return (entryId: number, code: string, diagramId?: string): boolean => {
    const id: string = diagramId ?? requireActiveId(ctx);
    const { diagram, stack } = stackOf(ctx, id);
    if (!canAmend(stack, entryId)) {
      return false;
    }
    setStack(ctx, id, amendEdit(stack, { entryId, code, now: ctx.deps.now() }));
    if (diagram.code !== code) {
      applyPatch(ctx, id, { code });
    }
    return true;
  };
}

function closeGroupAction(ctx: StoreContext): EditActions['closeEditGroup'] {
  return (): void => {
    const { activeId, histories } = ctx.get();
    const stack: EditStack | undefined = activeId === null ? undefined : histories[activeId];
    if (activeId !== null && stack !== undefined) {
      setStack(ctx, activeId, closeEditGroup(stack));
    }
  };
}

/** Moves through the history unless a guard holds it (`history-guard.ts`): then nothing moves. */
function guardedMove(ctx: StoreContext, target: (stack: EditStack) => number | undefined): void {
  if (historyOverride(ctx.get().activeId) === null) {
    moveTo(ctx, target);
  }
}

/** `applyEdit`, `amendEdit`, the typing group, undo, redo and jumps. */
export function editActions(ctx: StoreContext): EditActions {
  return {
    applyEdit: applyEditAction(ctx),
    amendEdit: amendEditAction(ctx),
    closeEditGroup: closeGroupAction(ctx),
    undo: (): void => {
      if (!runHistoryOverride(ctx.get().activeId)) {
        moveTo(ctx, (stack) => (stack.index > 0 ? stack.index - 1 : undefined));
      }
    },
    redo: (): void => {
      guardedMove(ctx, (stack) =>
        stack.index < stack.entries.length - 1 ? stack.index + 1 : undefined,
      );
    },
    jumpTo: (index: number): void => {
      guardedMove(ctx, () => index);
    },
  };
}
