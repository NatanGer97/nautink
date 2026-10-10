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

/** Shift/⌘-click on a header: adds the participant to the selected ones, or takes it out. */
export function toggledParticipant(selection: SequenceSelection, id: string): SequenceSelection {
  if (selection.kind !== 'participant') {
    return participantSelection(id);
  }
  const ids: string[] = selection.ids.includes(id)
    ? selection.ids.filter((other) => other !== id)
    : [...selection.ids, id];
  return ids.length === 0 ? NO_SELECTION : { kind: 'participant', ids };
}

export function itemSelection(ids: readonly string[], anchor?: string): SequenceSelection {
  return anchor === undefined ? { kind: 'items', ids } : { kind: 'items', ids, anchor };
}
