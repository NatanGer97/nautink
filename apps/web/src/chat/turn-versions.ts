import { addVersion, countVersions } from '@nautink/storage/versions';

import type { NautinkDb } from '@nautink/storage/db';

/** Fired on `window` after a version is added, so the history panel can reload. */
export const VERSIONS_CHANGED_EVENT: string = 'nautink:versions-changed';

/** `detail` of `VERSIONS_CHANGED_EVENT`. */
export interface VersionsChangedDetail {
  diagramId: string;
}

/** The label of the snapshot taken before Claude's first change to a diagram (v1). */
export const BEFORE_CLAUDE_LABEL: string = 'Before Claude';

export interface TurnVersionInput {
  db: NautinkDb;
  diagramId: string;
  /** The code when the turn started. */
  before: string;
  /** The code the turn ended with. */
  after: string;
  /** What the user asked. */
  prompt: string;
}

/**
 * Saves a `claude` version of the turn's result, as v1 does: before Claude's first change to a
 * diagram, the starting code is kept as a named "Before Claude" version so it can be restored.
 */
export async function saveTurnVersions(input: TurnVersionInput): Promise<void> {
  const { db, diagramId, before, after, prompt } = input;
  const isFirstChange: boolean = (await countVersions(db, diagramId)) === 0;
  if (isFirstChange && before.trim() !== '') {
    await addVersion(db, { diagramId, code: before, kind: 'manual', label: BEFORE_CLAUDE_LABEL });
  }
  await addVersion(db, { diagramId, code: after, kind: 'claude', prompt });
  const detail: VersionsChangedDetail = { diagramId };
  window.dispatchEvent(new CustomEvent(VERSIONS_CHANGED_EVENT, { detail }));
}
