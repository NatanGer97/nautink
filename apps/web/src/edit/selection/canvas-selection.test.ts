import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  clearSelection,
  publishSelection,
  requestSelection,
  resetCanvasSelection,
  selectedIdsOf,
  selectionSummary,
  useCanvasSelection,
  useCanvasSelectionStore,
  useSelectionRequests,
} from './canvas-selection.ts';

afterEach(() => {
  resetCanvasSelection();
});

const NODE_A = { id: 'A', label: 'Start', kind: 'node' };
const NODE_B = { id: 'B', label: 'Done', kind: 'node' };

describe('canvas selection', () => {
  it('keeps what the editor selected, per diagram, and skips unchanged reports', () => {
    const { result } = renderHook(() => useCanvasSelection());
    publishSelection('d1', [NODE_A]);
    const items = useCanvasSelectionStore.getState().items;
    publishSelection('d1', [{ ...NODE_A }]);
    expect(useCanvasSelectionStore.getState().items).toBe(items);
    expect(selectedIdsOf(useCanvasSelectionStore.getState(), 'd1')).toEqual(['A']);
    expect(selectedIdsOf(useCanvasSelectionStore.getState(), 'd2')).toEqual([]);
    clearSelection();
    expect(result.current).toEqual({ diagramId: null, items: [] });
  });

  it('summarizes the selection for the prompt chip', () => {
    expect(selectionSummary([])).toBe('');
    expect(selectionSummary([NODE_A])).toBe('1 node selected');
    expect(selectionSummary([NODE_A, NODE_B])).toBe('2 nodes selected');
    expect(selectionSummary([NODE_A, { id: 'L', label: '', kind: 'link' }])).toBe(
      '2 items selected',
    );
    expect(
      selectionSummary([
        { id: 'X', label: '', kind: 'class' },
        { id: 'Y', label: '', kind: 'class' },
      ]),
    ).toBe('2 classes selected');
  });

  it("hands each selection request to that diagram's editor once", () => {
    const select = vi.fn();
    renderHook(() => {
      useSelectionRequests('d1', select);
    });
    requestSelection('d1', ['A']);
    requestSelection('d2', ['B']);
    publishSelection('d1', [NODE_A]);
    requestSelection('d1', ['A']);
    expect(select.mock.calls).toEqual([[['A']], [['A']]]);
  });
});
