import { describe, expect, it } from 'vitest';

import { markSelectedShapes, SELECTED_ATTRIBUTE } from './shape-highlight.ts';

describe('markSelectedShapes', () => {
  it('marks the rendered nodes whose Mermaid id is selected, and unmarks the rest', () => {
    const stage = document.createElement('div');
    stage.innerHTML =
      '<svg><g id="m-flowchart-A-0" class="node"></g><g id="m-flowchart-B-1" class="node"></g></svg>';
    expect(markSelectedShapes(stage, new Set(['A']))).toBe(1);
    expect(stage.querySelector('#m-flowchart-A-0')?.hasAttribute(SELECTED_ATTRIBUTE)).toBe(true);
    expect(markSelectedShapes(stage, new Set(['B']))).toBe(1);
    expect(stage.querySelector('#m-flowchart-A-0')?.hasAttribute(SELECTED_ATTRIBUTE)).toBe(false);
  });
});
