import { describe, expect, it } from 'vitest';

import { isDiagramView, noEditorMessage, shownView, viewAvailability } from './canvas-views.ts';
import { lazyEditor } from './editor-registry.ts';

import type { EditorRegistry } from './editor-registry.ts';

const WITH_FLOW: EditorRegistry = {
  flow: lazyEditor(async () => Promise.resolve(() => null)),
};

describe('viewAvailability', () => {
  it('allows Edit and Split for a type with an editor', () => {
    expect(viewAvailability('flowchart TD\n  A --> B', WITH_FLOW)).toEqual({
      hasEditor: true,
      isEmpty: false,
      reason: null,
    });
  });

  it('explains why a code-only type has no Edit or Split (M7)', () => {
    expect(viewAvailability('gantt\n  title Plan', WITH_FLOW).reason).toBe(
      "Visual editing isn't available for Gantt diagrams. Change it in code, or ask Claude.",
    );
    expect(viewAvailability('classDiagram\n  class A', {}).hasEditor).toBe(false);
  });

  it('lets an empty diagram open Edit, where it is invited to start', () => {
    expect(viewAvailability('  \n', WITH_FLOW)).toEqual({
      hasEditor: false,
      isEmpty: true,
      reason: null,
    });
  });
});

describe('shownView', () => {
  it('falls back from Split to Preview when there is no editor to show beside it', () => {
    const none = viewAvailability('pie\n  "A" : 1', WITH_FLOW);
    expect(shownView('split', none)).toBe('preview');
    expect(shownView('edit', none)).toBe('edit');
    expect(shownView('split', viewAvailability('flowchart LR', WITH_FLOW))).toBe('split');
  });
});

describe('labels', () => {
  it('names the type in the no-editor message and checks view names', () => {
    expect(noEditorMessage('mindmap\n  root')).toBe(
      'No visual editor for Mindmap yet. Use code or chat.',
    );
    expect(isDiagramView('split')).toBe(true);
    expect(isDiagramView('zoom')).toBe(false);
  });
});
