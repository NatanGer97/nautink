import { afterEach, describe, expect, it } from 'vitest';

import {
  chatSelectionFor,
  removeSelectionChip,
  resetSelectionChip,
  toChatSelection,
} from './chat-selection.ts';
import { clearSelection, publishSelection } from '../edit/selection/canvas-selection.ts';

const A = { id: 'a', label: 'Start', kind: 'node' };
const B = { id: 'L_a_b_0', label: 'Start → b', kind: 'link' };

afterEach(() => {
  resetSelectionChip();
});

describe('toChatSelection', () => {
  it('turns items into parallel ids, labels and kinds', () => {
    expect(toChatSelection([A, B])).toEqual({
      ids: ['a', 'L_a_b_0'],
      labels: ['Start', 'Start → b'],
      kinds: ['node', 'link'],
    });
  });

  it('is null for no items', () => {
    expect(toChatSelection([])).toBeNull();
  });
});

describe('chatSelectionFor', () => {
  it('carries the open diagram’s selection only', () => {
    publishSelection('d1', [A]);
    expect(chatSelectionFor('d1')?.ids).toEqual(['a']);
    expect(chatSelectionFor('d2')).toBeNull();
  });

  it('is null after the chip is removed, until the selection changes', () => {
    publishSelection('d1', [A]);
    removeSelectionChip();
    expect(chatSelectionFor('d1')).toBeNull();
    publishSelection('d1', [A]);
    expect(chatSelectionFor('d1')).toBeNull();
    publishSelection('d1', [A, B]);
    expect(chatSelectionFor('d1')?.ids).toEqual(['a', 'L_a_b_0']);
  });

  it('comes back when the same items are selected again after a clear', () => {
    publishSelection('d1', [A]);
    removeSelectionChip();
    clearSelection();
    publishSelection('d1', [A]);
    expect(chatSelectionFor('d1')?.ids).toEqual(['a']);
  });
});
