import type { ReviewElement } from './review-element.ts';
import type { EditorModule } from '@nautink/visual-core/editor-contract';

/** What a change review needs from one editor: its model, its elements, and the merged model. */
export interface ReviewAdapter<Model> {
  module: EditorModule<Model>;
  elements: (model: Model) => ReviewElement[];
  /** The proposal (`after`) plus the elements it removed from `before`, to draw them as ghosts. */
  union: (before: Model, after: Model) => Model;
}
