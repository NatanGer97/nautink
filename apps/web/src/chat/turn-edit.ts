import type { WorkspaceState } from '../workspace/workspace-state.ts';
import type { Diagram } from '@nautink/storage/records';

/** The diagram, or `undefined` once it was deleted while Claude replied. */
export function findTurnDiagram(state: WorkspaceState, diagramId: string): Diagram | undefined {
  return state.diagrams.find((diagram) => diagram.id === diagramId);
}

/** Where a turn puts the code it shows: straight into the diagram, or into a proposal. */
export interface TurnCodeSink {
  /** The undo step that holds the turn's code, or `null` when there is none (yet). */
  readonly entryId: number | null;
  /** Shows `code` as the turn's code. `label` names the undo step if one is recorded. */
  show: (code: string, label: string) => void;
  /** Puts back `code` after a stop. */
  revert: (code: string) => void;
}

/**
 * One Claude turn as one undo step (PRD §3.1). The first code the turn shows records a step; later
 * code (streamed chunks, auto-fix retries) amends it. If the user changed the code in between, the
 * next code records a new step instead.
 */
export class TurnEdit implements TurnCodeSink {
  private readonly diagramId: string;
  private readonly workspace: () => WorkspaceState;
  private entry: number | null = null;

  constructor(diagramId: string, workspace: () => WorkspaceState) {
    this.diagramId = diagramId;
    this.workspace = workspace;
  }

  /** The step that holds the turn's code, or `null` before the turn changed anything. */
  get entryId(): number | null {
    return this.entry;
  }

  /** Puts `code` in the diagram as this turn's step. `label` names the step if one is recorded. */
  show(code: string, label: string): void {
    const state: WorkspaceState = this.workspace();
    const diagram: Diagram | undefined = findTurnDiagram(state, this.diagramId);
    if (diagram === undefined) {
      return;
    }
    if (this.entry !== null && state.amendEdit(this.entry, code, this.diagramId)) {
      return;
    }
    // Recording the current code would hand back someone else's step, so nothing is recorded.
    if (diagram.code === code) {
      return;
    }
    this.entry = state.applyEdit(code, { label, source: 'claude', diagramId: this.diagramId }).id;
  }

  /** Puts `code` back after a stop, only through the turn's own step (never a new one). */
  revert(code: string): void {
    const state: WorkspaceState = this.workspace();
    if (this.entry !== null && findTurnDiagram(state, this.diagramId) !== undefined) {
      state.amendEdit(this.entry, code, this.diagramId);
    }
  }
}
