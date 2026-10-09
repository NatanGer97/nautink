import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { usePreviewStatusStore } from './preview-status.ts';
import {
  RENDER_DELAY_MS,
  renderEvent,
  scheduleRender,
  useDiagramRender,
} from './use-diagram-render.ts';

const renderDiagram = vi.hoisted(() => vi.fn());

vi.mock('./render-diagram.ts', () => ({ renderDiagram }));

beforeEach(() => {
  vi.useFakeTimers();
  renderDiagram.mockReset();
  renderDiagram.mockResolvedValue({ kind: 'rendered', svg: '<svg/>', renderMs: 5 });
});

afterEach(() => {
  vi.useRealTimers();
  usePreviewStatusStore.getState().reset();
});

describe('renderEvent', () => {
  it('maps an outcome to a status event', () => {
    expect(renderEvent('a', { kind: 'rendered', svg: 's', renderMs: 1 })).toEqual({
      kind: 'rendered',
      diagramId: 'a',
      svg: 's',
      renderMs: 1,
    });
    const error = { message: 'm', line: null };
    expect(renderEvent('a', { kind: 'failed', error })).toEqual({
      kind: 'failed',
      diagramId: 'a',
      error,
    });
  });
});

describe('scheduleRender', () => {
  it('renders after the delay and reports the result', async () => {
    const report = vi.fn();
    scheduleRender({ diagramId: 'a', code: 'flowchart TD', isDark: false }, report);
    expect(renderDiagram).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(RENDER_DELAY_MS);
    expect(renderDiagram).toHaveBeenCalledWith({ code: 'flowchart TD', isDark: false });
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'rendered', diagramId: 'a' }),
    );
  });

  it('drops a render cancelled before or while it runs', async () => {
    const report = vi.fn();
    scheduleRender({ diagramId: 'a', code: 'x', isDark: false }, report)();
    await vi.advanceTimersByTimeAsync(RENDER_DELAY_MS);
    expect(renderDiagram).not.toHaveBeenCalled();
    let finish: (value: unknown) => void = () => undefined;
    renderDiagram.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));
    const cancel = scheduleRender({ diagramId: 'a', code: 'x', isDark: false }, report);
    await vi.advanceTimersByTimeAsync(RENDER_DELAY_MS);
    cancel();
    finish({ kind: 'rendered', svg: '', renderMs: 1 });
    await vi.advanceTimersByTimeAsync(0);
    expect(report).not.toHaveBeenCalled();
  });
});

describe('useDiagramRender', () => {
  it('reports empty code at once and renders other code after the delay', async () => {
    const { rerender } = renderHook(
      (code: string) => {
        useDiagramRender({ diagramId: 'a', code, isDark: false });
      },
      { initialProps: '  ' },
    );
    expect(usePreviewStatusStore.getState()).toMatchObject({ diagramId: 'a', validity: 'empty' });
    rerender('flowchart TD');
    await vi.advanceTimersByTimeAsync(RENDER_DELAY_MS);
    expect(usePreviewStatusStore.getState()).toMatchObject({ validity: 'valid', svg: '<svg/>' });
  });
});
