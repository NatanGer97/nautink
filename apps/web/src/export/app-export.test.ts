import { afterEach, describe, expect, it } from 'vitest';

import { readExportSource } from './app-export.ts';
import { viewVersion } from '../history/viewed-version.ts';
import { usePreviewStatusStore } from '../preview/preview-status.ts';
import { useWorkspaceStore } from '../workspace/use-workspace.ts';

import type { Version } from '@nautink/storage/records';

afterEach(() => {
  viewVersion(null);
  usePreviewStatusStore.getState().reset();
});

describe('readExportSource', () => {
  it('exports what is on the canvas: a viewed version, not the current code', async () => {
    await useWorkspaceStore.getState().load();
    const id: string = useWorkspaceStore.getState().activeId ?? '';
    useWorkspaceStore
      .getState()
      .applyEdit('flowchart TD\n  Now', { label: 'Typed in code', source: 'code' });
    const version: Version = {
      id: 'v1',
      diagramId: id,
      code: 'flowchart TD\n  Then',
      createdAt: 1,
      kind: 'manual',
      label: 'Before',
      prompt: '',
    };
    usePreviewStatusStore
      .getState()
      .report({ kind: 'rendered', diagramId: id, svg: '<svg>now</svg>', renderMs: 1 });
    expect(readExportSource()).toMatchObject({
      code: 'flowchart TD\n  Now',
      svg: '<svg>now</svg>',
    });
    viewVersion(version);
    expect(readExportSource()).toMatchObject({ code: 'flowchart TD\n  Then', svg: '' });
    usePreviewStatusStore
      .getState()
      .report({ kind: 'rendered', diagramId: 'version:v1', svg: '<svg>then</svg>', renderMs: 1 });
    expect(readExportSource()).toMatchObject({
      code: 'flowchart TD\n  Then',
      svg: '<svg>then</svg>',
    });
  });
});
