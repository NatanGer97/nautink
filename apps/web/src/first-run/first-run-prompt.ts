import { finishFirstRun } from './first-run-store.ts';
import { useUiStore } from '../state/ui-store.ts';
import { selectActiveDiagram, useWorkspaceStore } from '../workspace/use-workspace.ts';

import type { WorkspaceState } from '../workspace/workspace-state.ts';
import type { Diagram } from '@nautink/storage/records';

/** A type the first-run prompt can ask for; `auto` lets Claude choose. */
export interface FirstRunType {
  id: string;
  label: string;
  /** The first line of the new diagram, or '' for `auto`. */
  header: string;
}

/** The type picker of M8. */
export const FIRST_RUN_TYPES: readonly FirstRunType[] = [
  { id: 'auto', label: 'Auto', header: '' },
  { id: 'flowchart', label: 'Flowchart', header: 'flowchart TD\n' },
  { id: 'sequence', label: 'Sequence', header: 'sequenceDiagram\n' },
  { id: 'class', label: 'Class', header: 'classDiagram\n' },
  { id: 'er', label: 'ER', header: 'erDiagram\n' },
  { id: 'state', label: 'State', header: 'stateDiagram-v2\n' },
];

/** The example chips of M8, each with the type it suits. */
export const FIRST_RUN_EXAMPLES: readonly { text: string; typeId: string }[] = [
  { text: 'OAuth login with PKCE', typeId: 'sequence' },
  { text: 'Database for a blog', typeId: 'er' },
  { text: 'CI pipeline with rollback', typeId: 'flowchart' },
  { text: 'Order lifecycle states', typeId: 'state' },
];

/** The type with this id. Throws for an unknown id. */
export function firstRunType(id: string): FirstRunType {
  const type: FirstRunType | undefined = FIRST_RUN_TYPES.find((item) => item.id === id);
  if (type === undefined) {
    throw new Error(`Unknown diagram type "${id}".`);
  }
  return type;
}

/**
 * Starts the first diagram from the prompt: the chosen type's header becomes the code (one undo
 * step), the text waits in the chat draft, and the chat opens with its composer focused. Sending
 * is the chat's job.
 */
export function startFromPrompt(text: string, type: FirstRunType): void {
  const workspace: WorkspaceState = useWorkspaceStore.getState();
  const diagram: Diagram | undefined = selectActiveDiagram(workspace);
  if (diagram === undefined || text.trim() === '') {
    return;
  }
  if (type.header !== '' && type.header !== diagram.code) {
    workspace.applyEdit(type.header, {
      label: `Started a ${type.label.toLowerCase()}`,
      source: 'template',
    });
  }
  workspace.setDraft(diagram.id, text.trim());
  finishFirstRun();
  useUiStore.getState().focusComposer();
}
