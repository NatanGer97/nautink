import { meaningfulLines } from '@nautink/storage/diagram-type';

import type { Diagram } from '@nautink/storage/records';

/**
 * True for a diagram nobody has worked on yet: at most a header line of code, no chat, no unsent
 * text, its automatic title and not pinned. The blank diagram made on first start is one.
 */
export function isUntouchedDiagram(diagram: Diagram): boolean {
  return (
    meaningfulLines(diagram.code).length <= 1 &&
    diagram.messages.length === 0 &&
    diagram.draft.trim() === '' &&
    diagram.titleAuto &&
    !diagram.pinned
  );
}

/** True when the workspace holds only one untouched diagram (a first start, PRD §4.5). */
export function isUntouchedWorkspace(diagrams: readonly Diagram[]): boolean {
  const [only] = diagrams;
  return diagrams.length === 1 && only !== undefined && isUntouchedDiagram(only);
}
