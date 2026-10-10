/** What can be selected on the sequence canvas: participants, one box, or rows (items). */
export type SelectionKind = 'participant' | 'box' | 'items';

/**
 * What is selected (v1's `{ kind, ids }`). `anchor` is the row a Shift-click range starts from.
 */
export interface SequenceSelection {
  kind: SelectionKind | null;
  ids: readonly string[];
  anchor?: string;
}

export const NO_SELECTION: SequenceSelection = { kind: null, ids: [] };

/** Text edited in place on the canvas: a participant's name, a message, a note or a block label. */
export type EditTarget =
  | { kind: 'participant' | 'message' | 'note'; id: string }
  | { kind: 'section'; id: string; sectionIndex: number };

export function participantSelection(id: string): SequenceSelection {
  return { kind: 'participant', ids: [id] };
}

export function itemSelection(ids: readonly string[], anchor?: string): SequenceSelection {
  return anchor === undefined ? { kind: 'items', ids } : { kind: 'items', ids, anchor };
}
