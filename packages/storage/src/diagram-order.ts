import type { Diagram } from './records.ts';

/** Sort order of the diagram list: pinned first, then the most recently updated. */
export function compareDiagrams(
  left: Pick<Diagram, 'pinned' | 'updatedAt'>,
  right: Pick<Diagram, 'pinned' | 'updatedAt'>,
): number {
  if (left.pinned !== right.pinned) {
    return left.pinned ? -1 : 1;
  }
  return right.updatedAt - left.updatedAt;
}

/** A sorted copy; the input is left as it is. */
export function sortDiagrams<T extends Pick<Diagram, 'pinned' | 'updatedAt'>>(
  diagrams: readonly T[],
): T[] {
  return [...diagrams].sort(compareDiagrams);
}
