import type { Version } from './records.ts';

/** A copy sorted newest first. */
export function sortVersions(versions: readonly Version[]): Version[] {
  return [...versions].sort((left, right) => right.createdAt - left.createdAt);
}
