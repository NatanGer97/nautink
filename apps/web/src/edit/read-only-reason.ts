/** Shown on the canvas while `name`'s reply streams into the diagram (PRD §4.3). */
export function agentEditingText(name: string): string {
  return `${name} is editing… The canvas is read-only until the reply ends.`;
}

/** Shown while the history panel puts an older version on the canvas (M5). */
export const VIEWING_VERSION: string = 'Viewing an older version · read-only';

export interface ReadOnlyInput {
  isClaudeEditing: boolean;
  /** The chosen agent's name, for the editing reason. */
  agentName: string;
  isViewingVersion: boolean;
}

/** Why the visual editor cannot change the code now, or null when it can. */
export function readOnlyReason({
  isClaudeEditing,
  agentName,
  isViewingVersion,
}: ReadOnlyInput): string | null {
  if (isViewingVersion) {
    return VIEWING_VERSION;
  }
  return isClaudeEditing ? agentEditingText(agentName) : null;
}
