// Sequence diagrams keep no canvas positions (v1): the order of participants and rows decides the
// layout, which `computeLayout` works out from the model on every change.
import type { EditorPositionStore } from '../positions/app-position-store.ts';
import type { EditorLayout } from '../use-editor-core.ts';
import type { SequenceModel } from '@nautink/editors/sequence/types';
import type { PositionMap } from '@nautink/visual-core/positions';

/** The core's position hooks, with nothing to place: there are no free positions. */
export const SEQUENCE_LAYOUT: EditorLayout<SequenceModel> = {
  place: () => ({ positions: {}, isFullLayout: false }),
  layout: (): PositionMap => ({}),
};

/** Reads and writes nothing, so a sequence diagram never gets a positions record. */
export const NO_POSITION_STORE: EditorPositionStore = {
  load: async (): Promise<PositionMap> => Promise.resolve({}),
  save: async (): Promise<void> => Promise.resolve(),
};
