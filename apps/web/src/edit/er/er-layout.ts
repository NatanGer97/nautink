import { dagreLayout, placeEntities } from '@nautink/editors/er/layout';
import { entityLayout } from '@nautink/editors/er/size';

import { canvasTextMeasurer } from '../canvas/text-measurer.ts';

import type { EditorLayout } from '../use-editor-core.ts';
import type { ErEntity, ErModel } from '@nautink/editors/er/model';
import type { EntityLayout } from '@nautink/editors/er/size';
import type { Placement } from '@nautink/editors/shared/positions';
import type { PositionMap } from '@nautink/visual-core/positions';

/** An entity box's size and columns, measured as the layout measures it. */
export function entityBox(entity: ErEntity): EntityLayout {
  return entityLayout(entity, canvasTextMeasurer);
}

/** The ER layout functions from `@nautink/editors`, for `useEditorCore`. */
export const ER_LAYOUT: EditorLayout<ErModel> = {
  place: (model: ErModel, positions: PositionMap): Placement =>
    placeEntities(model, positions, canvasTextMeasurer),
  layout: (model: ErModel): PositionMap => dagreLayout(model, canvasTextMeasurer),
};
