import { dagreLayout, placeNodes, tagLabels } from '@nautink/editors/flow/layout';

import type { EditorLayout } from '../use-editor-core.ts';
import type { FlowGraph } from '@nautink/editors/flow/model';

/** The flowchart's layout functions from `@nautink/editors`, for `useEditorCore`. */
export const FLOW_LAYOUT: EditorLayout<FlowGraph> = {
  place: placeNodes,
  layout: dagreLayout,
  tag: tagLabels,
};
