import type { EditMeta } from './edit-history.ts';
import type { Diagram } from '@nautink/storage/records';

/** The code of a quick new diagram and of the first one (v1's blank flowchart). */
export const BLANK_FLOWCHART: string = 'flowchart TD\n';

/** The first step of a new diagram's edit history. */
export const NEW_DIAGRAM_STEP: EditMeta = { label: 'New blank flowchart', source: 'template' };

/** The first step of a diagram opened in this session. */
export const OPENED_STEP: EditMeta = { label: 'Opened', source: 'open' };

/** A step for code that changed outside the history (another tab, an import). */
export const EXTERNAL_STEP: EditMeta = { label: 'Edited diagram', source: 'external' };

/** The fields of a new blank diagram created at `now`. */
export function blankDiagramFields(now: number): Partial<Diagram> {
  return { code: BLANK_FLOWCHART, createdAt: now, updatedAt: now };
}
