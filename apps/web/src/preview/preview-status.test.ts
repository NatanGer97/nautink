import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  INITIAL_PREVIEW_STATUS,
  nextPreviewStatus,
  usePreviewStatus,
  usePreviewStatusStore,
} from './preview-status.ts';

const error = { message: 'Parse error on line 2', line: 2 };

afterEach(() => {
  usePreviewStatusStore.getState().reset();
});

describe('nextPreviewStatus', () => {
  const rendered = nextPreviewStatus(INITIAL_PREVIEW_STATUS, {
    kind: 'rendered',
    diagramId: 'a',
    svg: '<svg/>',
    renderMs: 12,
  });

  it('records a good render', () => {
    expect(rendered).toEqual({
      diagramId: 'a',
      validity: 'valid',
      error: null,
      renderMs: 12,
      svg: '<svg/>',
    });
  });

  it('keeps the last good SVG when the same diagram stops parsing', () => {
    const failed = nextPreviewStatus(rendered, { kind: 'failed', diagramId: 'a', error });
    expect(failed).toEqual({ ...rendered, validity: 'invalid', error });
  });

  it('drops the SVG of another diagram on a failure', () => {
    const failed = nextPreviewStatus(rendered, { kind: 'failed', diagramId: 'b', error });
    expect(failed).toEqual({
      diagramId: 'b',
      validity: 'invalid',
      error,
      renderMs: null,
      svg: '',
    });
  });

  it('marks empty code as empty', () => {
    expect(nextPreviewStatus(rendered, { kind: 'empty', diagramId: 'a' })).toEqual({
      ...INITIAL_PREVIEW_STATUS,
      diagramId: 'a',
    });
  });
});

describe('usePreviewStatus', () => {
  it('follows the store', () => {
    const { result } = renderHook(() => usePreviewStatus());
    expect(result.current.validity).toBe('empty');
    act(() => {
      usePreviewStatusStore.getState().report({ kind: 'failed', diagramId: 'a', error });
    });
    expect(result.current).toMatchObject({ diagramId: 'a', validity: 'invalid', error });
  });
});
