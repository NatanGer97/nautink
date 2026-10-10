import { dagreLayout, placeItems, tagItems } from '@nautink/editors/class/layout';

import { canvasTextMeasurer } from '../canvas/text-measurer.ts';

import type { EditorLayout } from '../use-editor-core.ts';
import type { ClassModel } from '@nautink/editors/class/types';

/** The class diagram's layout functions from `@nautink/editors`, measuring text in a canvas. */
export const CLASS_LAYOUT: EditorLayout<ClassModel> = {
  place: (model, positions) => placeItems(model, positions, canvasTextMeasurer),
  layout: (model) => dagreLayout(model, canvasTextMeasurer),
  tag: tagItems,
};
