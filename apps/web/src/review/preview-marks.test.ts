import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { markReviewShapes, REVIEW_ATTRIBUTE, usePreviewReviewMarks } from './preview-marks.ts';

import type { PreviewReview } from './preview-marks.ts';
import type { ReviewMark, ReviewTarget } from '@nautink/editors/review/review-element';
import type { EditorId } from '@nautink/visual-core/editor-contract';

// The element ids Mermaid gives each diagram type, as rendered (render id `r`).
const SVG = `<svg xmlns="http://www.w3.org/2000/svg">
  <g id="r-G" class="cluster"></g>
  <path id="r-L_A_B_0" data-id="L_A_B_0"></path>
  <g class="label" data-id="L_A_B_0"></g>
  <g id="r-flowchart-A-0" class="node default"></g>
  <path id="r-id_Order_Item_1" data-id="id_Order_Item_1"></path>
  <g id="r-classId-Order-0" class="node default"></g>
  <g id="r-note0" class="node undefined"></g>
  <path data-id="id_entity-CUSTOMER-0_entity-ORDER-1_0"></path>
  <g id="r-entity-ORDER-1" class="node default"></g>
  <path data-id="edge1"></path>
  <g id="r-state-Idle----note-3" class="node statediagram-note"></g>
  <rect name="Alice" class="actor actor-top"></rect>
  <line name="Alice" class="actor-line"></line>
  <text class="messageText">hi</text>
  <line class="messageLine0"></line>
  <text class="messageText">bye</text>
  <line class="messageLine1"></line>
</svg>`;

function target(fields: Partial<ReviewTarget> & Pick<ReviewTarget, 'id' | 'kind'>): ReviewTarget {
  return {
    key: `${fields.kind}:${fields.id}`,
    sig: '',
    label: '',
    mark: 'added',
    order: 0,
    ...fields,
  };
}

function stage(): HTMLElement {
  const element = document.createElement('div');
  element.innerHTML = SVG;
  return element;
}

function nameOf(element: Element): string {
  const named: string | null = element.getAttribute('data-id') ?? element.getAttribute('name');
  return element.id === '' ? (named ?? element.textContent) : element.id;
}

function marked(root: Element): string[] {
  return [...root.querySelectorAll(`[${REVIEW_ATTRIBUTE}]`)].map(
    (element) => `${element.getAttribute(REVIEW_ATTRIBUTE) ?? ''} ${nameOf(element)}`,
  );
}

function review(editor: EditorId, targets: ReviewTarget[]): PreviewReview {
  return { editor, targets };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('markReviewShapes', () => {
  it('finds flowchart nodes, links and subgraphs', () => {
    const root = stage();
    const count = markReviewShapes(
      root,
      review('flow', [
        target({ id: 'A', kind: 'node', mark: 'changed' }),
        target({ id: 'L_A_B_0', kind: 'edge', mark: 'removed', ends: ['A', 'B'] }),
        target({ id: 'G', kind: 'group' }),
      ]),
    );
    expect(count).toBe(4);
    expect(marked(root)).toEqual([
      'added r-G',
      'removed r-L_A_B_0',
      'removed L_A_B_0',
      'changed r-flowchart-A-0',
    ]);
  });

  it('finds class relations and notes, ER relationships, state transitions and notes', () => {
    const cases: [EditorId, ReviewTarget, string][] = [
      [
        'class',
        target({ id: 'R:Order:Item:0', kind: 'edge', ends: ['Order', 'Item'] }),
        'r-id_Order_Item_1',
      ],
      ['class', target({ id: 'note:Order:0', kind: 'note', order: 0 }), 'r-note0'],
      [
        'er',
        target({ id: 'R', kind: 'edge', ends: ['CUSTOMER', 'ORDER'] }),
        'id_entity-CUSTOMER-0_entity-ORDER-1_0',
      ],
      ['er', target({ id: 'ORDER', kind: 'node' }), 'r-entity-ORDER-1'],
      ['state', target({ id: 't1', kind: 'edge', order: 1, ends: ['Idle', 'Busy'] }), 'edge1'],
      [
        'state',
        target({ id: 'note:Idle:0', kind: 'note', key: 'note:Idle' }),
        'r-state-Idle----note-3',
      ],
    ];
    for (const [editor, item, id] of cases) {
      const root = stage();
      markReviewShapes(root, review(editor, [item]));
      expect(marked(root)).toEqual([`added ${id}`]);
    }
  });

  it('finds sequence participants and the n-th message', () => {
    const root = stage();
    markReviewShapes(
      root,
      review('sequence', [
        target({ id: 'Alice', kind: 'participant', mark: 'removed' }),
        target({ id: 'i1', kind: 'message', order: 1 }),
        target({ id: 'i9', kind: 'message', order: 9 }),
      ]),
    );
    expect(marked(root)).toEqual(['removed Alice', 'added bye', 'added ']);
  });

  it('clears old marks, and marks nothing without a review', () => {
    const root = stage();
    markReviewShapes(root, review('flow', [target({ id: 'A', kind: 'node' })]));
    expect(markReviewShapes(root, null)).toBe(0);
    expect(marked(root)).toEqual([]);
  });

  it('tags a changed shape as edited when it can be measured', () => {
    const root = stage();
    const box: Pick<DOMRect, 'x' | 'y' | 'width' | 'height'> = {
      x: 0,
      y: 0,
      width: 100,
      height: 40,
    };
    Object.defineProperty(SVGElement.prototype, 'getBBox', {
      configurable: true,
      value: (): Pick<DOMRect, 'x' | 'y' | 'width' | 'height'> => box,
    });
    markReviewShapes(root, review('flow', [target({ id: 'A', kind: 'node', mark: 'changed' })]));
    expect(root.querySelector('[data-review-tag]')?.textContent).toBe('edited');
    markReviewShapes(root, null);
    expect(root.querySelector('[data-review-tag]')).toBeNull();
    Reflect.deleteProperty(SVGElement.prototype, 'getBBox');
  });
});

describe('usePreviewReviewMarks', () => {
  it('marks the stage after each render', () => {
    const root = stage();
    const ref = { current: root };
    const mark: ReviewMark = 'added';
    renderHook(() => {
      usePreviewReviewMarks(ref, SVG, review('flow', [target({ id: 'A', kind: 'node', mark })]));
    });
    expect(marked(root)).toEqual(['added r-flowchart-A-0']);
    renderHook(() => {
      usePreviewReviewMarks({ current: null }, SVG, null);
    });
  });
});
