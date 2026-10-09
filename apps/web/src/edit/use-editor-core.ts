import { useMemo, useState } from 'react';

import { usePositionBook } from './positions/use-position-book.ts';
import { useDiagramSync } from './sync/use-diagram-sync.ts';

import type { VisualEditorProps } from './editor-props.ts';
import type { EditorPositionStore } from './positions/app-position-store.ts';
import type { PositionBook } from './positions/position-book.ts';
import type { PositionBookState } from './positions/use-position-book.ts';
import type { DiagramSyncState } from './sync/use-diagram-sync.ts';
import type { Placement } from '@nautink/editors/shared/positions';
import type { DiagramLoader, EditorModule } from '@nautink/visual-core/editor-contract';
import type { PositionMap } from '@nautink/visual-core/positions';

/** Shown while the code does not parse: the last good canvas stays, read-only (v1). */
export const SYNTAX_ERROR_REASON: string =
  'The code has a syntax error. The canvas is read-only until it parses.';

/** Shown when Mermaid reads the code as another diagram type than this editor's. */
export const UNSUPPORTED_REASON: string =
  'The editor cannot read this code as this diagram type. Use code or chat.';

/** The layout functions an editor brings; each is pure and comes from `@nautink/editors`. */
export interface EditorLayout<Model> {
  /** After an outside change: keep known items, place new ones, or lay out again (`placeNodes`). */
  place: (model: Model, positions: PositionMap) => Placement;
  /** The toolbar's "Auto layout" (dagre). */
  layout: (model: Model) => PositionMap;
  /** Before a commit: remember each item's label next to its spot (`tagLabels`). Optional. */
  tag?: (model: Model, positions: PositionMap) => PositionMap;
}

export interface EditorCoreInput<Model> {
  props: VisualEditorProps;
  module: EditorModule<Model>;
  /** A module-level constant, so the callbacks built from it stay stable. */
  layout: EditorLayout<Model>;
  /** For tests: another parser or position store. */
  load?: DiagramLoader;
  store?: EditorPositionStore;
}

/** The editor's own commands, built once per editor. */
interface CoreActions<Model> {
  commit: (next: Model, label: string) => void;
  autoLayout: () => void;
}

export interface EditorCore<Model>
  extends Omit<DiagramSyncState<Model>, 'commit'>, CoreActions<Model> {
  /** Why the canvas cannot be edited now (Claude, an older version, a syntax error), or null. */
  readOnlyReason: string | null;
  isReadOnly: boolean;
  book: PositionBook;
  positions: PositionMap;
  /** Bumped whenever the canvas should fit the diagram (first open, full layout, auto layout). */
  fitRequest: number;
  requestFit: () => void;
}

function reasonOf<Model>(props: VisualEditorProps, sync: DiagramSyncState<Model>): string | null {
  if (props.readOnlyReason !== null) {
    return props.readOnlyReason;
  }
  if (sync.failure === null) {
    return null;
  }
  return sync.failure.kind === 'error' ? SYNTAX_ERROR_REASON : UNSUPPORTED_REASON;
}

interface PlaceContext<Model> {
  layout: EditorLayout<Model>;
  book: PositionBook;
  requestFit: () => void;
}

/** After an outside change: place new items next to known ones, and fit on open or a full layout. */
function placeOnExternal<Model>({
  layout,
  book,
  requestFit,
}: PlaceContext<Model>): (model: Model, previous: Model | null) => void {
  return (model: Model, previous: Model | null): void => {
    const placed: Placement = layout.place(model, book.get());
    book.replace(placed.positions);
    if (placed.isFullLayout || previous === null) {
      requestFit();
    }
  };
}

function tagged<Model>(
  layout: EditorLayout<Model>,
  model: Model,
  positions: PositionMap,
): PositionMap {
  return layout.tag === undefined ? positions : layout.tag(model, positions);
}

function coreActions<Model>(
  { layout, book, requestFit }: PlaceContext<Model>,
  sync: Pick<DiagramSyncState<Model>, 'commit' | 'getModel'>,
): CoreActions<Model> {
  return {
    commit: (next: Model, label: string): void => {
      book.replace(tagged(layout, next, book.get()));
      sync.commit(next, label);
    },
    autoLayout: (): void => {
      const model: Model | null = sync.getModel();
      if (model !== null) {
        book.replace(tagged(layout, model, layout.layout(model)));
        requestFit();
      }
    },
  };
}

function useFitRequest(): [number, () => void] {
  const [fitRequest, setFitRequest] = useState<number>(0);
  const requestFit: () => void = useMemo(
    () => (): void => {
      setFitRequest((count: number) => count + 1);
    },
    [],
  );
  return [fitRequest, requestFit];
}

function usePositions<Model>(input: EditorCoreInput<Model>): PositionBookState {
  return usePositionBook({
    diagramId: input.props.diagramId,
    ns: input.module.id,
    canSave: input.props.canSavePositions,
    ...(input.store ? { store: input.store } : {}),
  });
}

function useCoreSync<Model>(
  input: EditorCoreInput<Model>,
  context: PlaceContext<Model>,
  isLoaded: boolean,
): DiagramSyncState<Model> {
  const { props, module } = input;
  return useDiagramSync<Model>({
    code: props.code,
    module,
    isBusy: props.readOnlyReason !== null,
    isEnabled: isLoaded,
    onChange: props.onChange,
    onExternal: placeOnExternal(context),
    ...(input.load ? { load: input.load } : {}),
  });
}

/**
 * Everything an editor shares (PRD §3.4): the code ↔ model sync, its positions in IndexedDB, new
 * items placed after outside changes, fit requests, auto layout and read-only. An editor adds only
 * its canvas, toolbar and inspector.
 */
export function useEditorCore<Model>(input: EditorCoreInput<Model>): EditorCore<Model> {
  const { props, layout } = input;
  const [fitRequest, requestFit] = useFitRequest();
  const { book, positions, isLoaded } = usePositions(input);
  const sync: DiagramSyncState<Model> = useCoreSync(input, { layout, book, requestFit }, isLoaded);
  const actions: CoreActions<Model> = useCoreActions({ layout, book, requestFit }, sync);
  const readOnlyReason: string | null = reasonOf(props, sync);
  const isReadOnly: boolean = readOnlyReason !== null || sync.model === null;
  const shared: Omit<
    EditorCore<Model>,
    keyof DiagramSyncState<Model> | keyof CoreActions<Model>
  > = { readOnlyReason, isReadOnly, book, positions, fitRequest, requestFit };
  return { ...sync, ...actions, ...shared };
}

function useCoreActions<Model>(
  { layout, book, requestFit }: PlaceContext<Model>,
  { commit, getModel }: Pick<DiagramSyncState<Model>, 'commit' | 'getModel'>,
): CoreActions<Model> {
  return useMemo(
    () => coreActions({ layout, book, requestFit }, { commit, getModel }),
    [layout, book, requestFit, commit, getModel],
  );
}
