// Position upkeep around state edits: ids that change name keep their spot, and leaves an edit
// creates without a spot (an emptied composite, a moved [*]) get one before the commit.
import { placeNodes, tagLabels } from '@nautink/editors/state/layout';
import { pseudoOf } from '@nautink/editors/state/scopes';

import { boxOf, stateGeometry } from './state-geometry.ts';

import type { StateGeometry } from './state-geometry.ts';
import type { Leaf } from '@nautink/editors/state/layout';
import type { Pseudo, StateModel } from '@nautink/editors/state/types';
import type { Rect } from '@nautink/visual-core/geometry';
import type { Position, PositionMap } from '@nautink/visual-core/positions';

function isOwnScope(scope: string | null, from: string): boolean {
  return scope !== null && (scope === from || scope.startsWith(`${from}#`));
}

/** The key a position moves to when state `from` is renamed `to` (v1's `renameId` `mapKey`). */
export function renamedKey(key: string, from: string, to: string): string {
  if (key === from) {
    return to;
  }
  const pseudo: Pseudo | null = pseudoOf(key);
  if (pseudo && isOwnScope(pseudo.scope, from)) {
    return `${pseudo.kind}:${to}${(pseudo.scope ?? '').slice(from.length)}`;
  }
  const notePrefix: string = `note:${from}:`;
  return key.startsWith(notePrefix) ? `note:${to}:${key.slice(notePrefix.length)}` : key;
}

/** Positions with every key of a renamed state (its own, its [*] and its notes) moved along. */
export function renamedPositions(positions: PositionMap, from: string, to: string): PositionMap {
  return Object.fromEntries(
    Object.entries(positions).map(([key, position]: [string, Position]) => [
      renamedKey(key, from, to),
      position,
    ]),
  );
}

function missingLeaves(model: StateModel, positions: PositionMap): Leaf[] {
  return stateGeometry(model, positions).leaves.filter(
    (leaf: Leaf) => !Object.hasOwn(positions, leaf.id),
  );
}

/** A composite that lost its last child is drawn where its frame was. */
function fromOldFrames(
  missing: readonly Leaf[],
  previous: StateGeometry,
  positions: PositionMap,
): PositionMap {
  const placed: PositionMap = { ...positions };
  for (const leaf of missing) {
    const box: Rect | undefined = boxOf(previous, leaf.id);
    if (box !== undefined) {
      placed[leaf.id] = { x: box.x, y: box.y };
    }
  }
  return placed;
}

export interface MissingRequest {
  previous: StateModel;
  next: StateModel;
  positions: PositionMap;
}

/** Positions for `next` with a spot for every leaf; unchanged when none is missing. */
export function placeMissing({ previous, next, positions }: MissingRequest): PositionMap {
  const missing: Leaf[] = missingLeaves(next, positions);
  if (missing.length === 0) {
    return positions;
  }
  const kept: PositionMap = fromOldFrames(missing, stateGeometry(previous, positions), positions);
  if (missingLeaves(next, kept).length === 0) {
    return kept;
  }
  return placeNodes(next, tagLabels(next, kept)).positions;
}
