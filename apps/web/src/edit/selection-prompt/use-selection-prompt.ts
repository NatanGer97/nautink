import { useEffect, useRef, useState } from 'react';
import { create } from 'zustand';

import type { RefObject } from 'react';
import type { StoreApi, UseBoundStore } from 'zustand';

/** What an editor tells the floating selection prompt (PRD §4.1, M1). */
export interface SelectionPromptAdapter {
  /** The editor's root element: selected items are looked up inside it. */
  rootRef: RefObject<HTMLElement | null>;
  /**
   * The selected items' elements. Leave it out on a React Flow canvas: its selected nodes and
   * edges are found by class.
   */
  selectedElements?: (root: HTMLElement) => readonly Element[];
  /**
   * Every shape of the diagram, selected or not: the prompt keeps off the others when it can.
   * Leave it out on a React Flow canvas: its nodes are found by class.
   */
  shapeElements?: (root: HTMLElement) => readonly Element[];
  /** Groups the selection (subgraph, namespace, composite), or null to hide Group. */
  group: (() => void) | null;
  /** The editor's own read-only state (a syntax error, Claude editing, a viewed version). */
  isReadOnly: boolean;
}

/** How the host reaches the mounted editor; stable for the editor's life. */
export interface SelectionPromptHandle {
  /** Screen rectangles of the selected items now. */
  selectedRects: () => DOMRect[];
  /** Screen rectangles of the shapes that are not selected. */
  otherRects: () => DOMRect[];
  group: () => void;
}

interface PromptState {
  handle: SelectionPromptHandle | null;
  canGroup: boolean;
  isReadOnly: boolean;
}

const NO_EDITOR: PromptState = { handle: null, canGroup: false, isReadOnly: true };

/** The mounted editor's adapter. One visual editor is mounted at a time. */
export const useSelectionPromptStore: UseBoundStore<StoreApi<PromptState>> = create<PromptState>()(
  () => NO_EDITOR,
);

const REACT_FLOW_SELECTED: string = '.react-flow__node.selected, .react-flow__edge.selected';

/** The selected nodes and edges of a React Flow canvas. */
export function reactFlowSelected(root: HTMLElement): Element[] {
  return [...root.querySelectorAll(REACT_FLOW_SELECTED)];
}

/** Every node of a React Flow canvas. */
export function reactFlowShapes(root: HTMLElement): Element[] {
  return [...root.querySelectorAll('.react-flow__node')];
}

function elementsOf(adapter: SelectionPromptAdapter): { selected: Element[]; others: Element[] } {
  const root: HTMLElement | null = adapter.rootRef.current;
  if (root === null) {
    return { selected: [], others: [] };
  }
  const selected: Element[] = [...(adapter.selectedElements ?? reactFlowSelected)(root)];
  const shapes: readonly Element[] = (adapter.shapeElements ?? reactFlowShapes)(root);
  return { selected, others: shapes.filter((shape) => !selected.includes(shape)) };
}

function rectsOf(elements: readonly Element[]): DOMRect[] {
  return elements.map((element) => element.getBoundingClientRect());
}

function useStableHandle(adapter: SelectionPromptAdapter): SelectionPromptHandle {
  const latest: RefObject<SelectionPromptAdapter> = useRef<SelectionPromptAdapter>(adapter);
  useEffect(() => {
    latest.current = adapter;
  });
  const [handle] = useState<SelectionPromptHandle>(() => ({
    selectedRects: (): DOMRect[] => rectsOf(elementsOf(latest.current).selected),
    otherRects: (): DOMRect[] => rectsOf(elementsOf(latest.current).others),
    group: (): void => {
      latest.current.group?.();
    },
  }));
  return handle;
}

/**
 * Lets the host's floating selection prompt follow this editor's selection: where it is on screen,
 * and its Group action. Call it once in the editor's canvas component.
 */
export function useSelectionPrompt(adapter: SelectionPromptAdapter): void {
  const handle: SelectionPromptHandle = useStableHandle(adapter);
  const canGroup: boolean = adapter.group !== null;
  const { isReadOnly } = adapter;
  useEffect(() => {
    useSelectionPromptStore.setState({ handle, canGroup, isReadOnly });
  }, [handle, canGroup, isReadOnly]);
  useEffect(
    () => (): void => {
      if (useSelectionPromptStore.getState().handle === handle) {
        useSelectionPromptStore.setState(NO_EDITOR);
      }
    },
    [handle],
  );
}
