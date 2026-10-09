import { typeName } from '@nautink/storage/diagram-type';

import type { Diagram } from '@nautink/storage/records';
import type { SearchHit } from '@nautink/storage/search';

/** The chip that shows every diagram. */
export const ALL_FILTER: string = 'All';

/** The chip that shows pinned diagrams. Type names never collide with it. */
export const PINNED_FILTER: string = 'Pinned';

function typeCounts(diagrams: readonly Diagram[]): Map<string, number> {
  const counts: Map<string, number> = new Map<string, number>();
  for (const diagram of diagrams) {
    const name: string = typeName(diagram.code);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return counts;
}

/** The filter chips: All, Pinned when something is pinned, then the types present, most used first. */
export function typeFilters(diagrams: readonly Diagram[]): string[] {
  const types: string[] = [...typeCounts(diagrams)]
    .sort(
      ([leftName, left], [rightName, right]) => right - left || leftName.localeCompare(rightName),
    )
    .map(([name]) => name);
  const hasPinned: boolean = diagrams.some((diagram) => diagram.pinned);
  return [ALL_FILTER, ...(hasPinned ? [PINNED_FILTER] : []), ...types];
}

/** The hits that pass the chip. */
export function applyTypeFilter(hits: readonly SearchHit[], filter: string): SearchHit[] {
  if (filter === ALL_FILTER) {
    return [...hits];
  }
  if (filter === PINNED_FILTER) {
    return hits.filter((hit) => hit.diagram.pinned);
  }
  return hits.filter((hit) => typeName(hit.diagram.code) === filter);
}

const STEPS: Readonly<Record<string, number>> = { ArrowDown: 1, ArrowUp: -1 };

/** Where an arrow, Home or End key moves the list cursor; undefined for any other key. */
export function nextCursor(
  ids: readonly string[],
  current: string | null,
  key: string,
): string | undefined {
  if (key === 'Home' || key === 'End') {
    return key === 'Home' ? ids[0] : ids.at(-1);
  }
  const step: number | undefined = STEPS[key];
  if (step === undefined) {
    return undefined;
  }
  const index: number = current === null ? -1 : ids.indexOf(current);
  if (index < 0) {
    return ids[0];
  }
  return ids[Math.min(ids.length - 1, Math.max(0, index + step))];
}
