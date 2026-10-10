// What every class edit needs (v1's ClassEditor `commit`, `posRef`, `selectAfterCommit`), pure of
// React: each action reads the newest model and positions when it runs.
import type { ClassEditing, ClassSelection } from './class-types.ts';
import type { ClassModel } from '@nautink/editors/class/types';
import type { Point } from '@nautink/visual-core/geometry';
import type { Position, PositionMap } from '@nautink/visual-core/positions';

export interface ClassActionContext {
  getModel: () => ClassModel | null;
  commit: (next: ClassModel, label: string) => void;
  positions: {
    get: () => PositionMap;
    set: (id: string, point: Point) => void;
    replace: (positions: PositionMap) => void;
  };
  select: (selection: ClassSelection) => void;
  setEditing: (editing: ClassEditing | null) => void;
  requestFit: () => void;
}

/** One edit: the next model and its step label. */
export type ClassEdit = (model: ClassModel) => [ClassModel, string];

/** Runs one edit on the newest model and commits it with its label. */
export function run(context: ClassActionContext, edit: ClassEdit): void {
  const model: ClassModel | null = context.getModel();
  if (model !== null) {
    const [next, label] = edit(model);
    context.commit(next, label);
  }
}

/** An item got a new id (a renamed class, a re-attached note): its spot goes with it. */
export function movePosition(context: ClassActionContext, from: string, to: string): void {
  const positions: PositionMap = context.positions.get();
  const spot: Position | undefined = Object.hasOwn(positions, from) ? positions[from] : undefined;
  if (from === to || spot === undefined) {
    return;
  }
  const rest: PositionMap = Object.fromEntries(
    Object.entries(positions).filter(([id]) => id !== from),
  );
  context.positions.replace({ ...rest, [to]: spot });
}
