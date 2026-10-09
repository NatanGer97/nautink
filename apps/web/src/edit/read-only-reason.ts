/** Shown on the canvas while Claude's reply streams into the diagram (PRD §4.3). */
export const CLAUDE_EDITING: string =
  'Claude is editing… The canvas is read-only until the reply ends.';

/** Shown while the history panel puts an older version on the canvas (M5). */
export const VIEWING_VERSION: string = 'Viewing an older version · read-only';

export interface ReadOnlyInput {
  isClaudeEditing: boolean;
  isViewingVersion: boolean;
}

/** Why the visual editor cannot change the code now, or null when it can. */
export function readOnlyReason({
  isClaudeEditing,
  isViewingVersion,
}: ReadOnlyInput): string | null {
  if (isViewingVersion) {
    return VIEWING_VERSION;
  }
  return isClaudeEditing ? CLAUDE_EDITING : null;
}
