import { TooltipProvider } from '@nautink/ui/components/tooltip';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useFocusModeStore } from './focus-mode.ts';
import { PreviewCanvas } from './preview-canvas.tsx';
import { usePreviewStatusStore } from './preview-status.ts';
import { useCodeRevealStore } from '../code/code-reveal.ts';
import { commandRegistry } from '../commands/command-registry.ts';
import { useViewedVersionStore, viewVersion } from '../history/viewed-version.ts';
import { useUiStore } from '../state/ui-store.ts';
import { useWorkspaceStore } from '../workspace/use-workspace.ts';

import type { RenderOutcome } from './render-diagram.ts';

const renderDiagram = vi.hoisted(() => vi.fn<() => Promise<RenderOutcome>>());

vi.mock('./render-diagram.ts', () => ({ renderDiagram }));

const SVG =
  '<svg viewBox="0 0 120 60"><g class="node" id="nautink-render-1-flowchart-A-0"><rect></rect></g></svg>';

beforeEach(() => {
  renderDiagram.mockResolvedValue({ kind: 'rendered', svg: SVG, renderMs: 7 });
});

afterEach(() => {
  usePreviewStatusStore.getState().reset();
  useFocusModeStore.getState().setFocusMode(false);
});

async function renderLoaded(code: string, onShapeClick?: (target: Element) => void): Promise<void> {
  await useWorkspaceStore.getState().load();
  act(() => {
    useWorkspaceStore.getState().applyEdit(code, { label: 'Pasted code', source: 'code' });
  });
  render(
    <TooltipProvider>
      <PreviewCanvas {...(onShapeClick ? { onShapeClick } : {})} />
    </TooltipProvider>,
  );
}

function stageSvg(): SVGSVGElement | null {
  return document.querySelector('[data-preview-stage] svg');
}

describe('PreviewCanvas', () => {
  it('says the diagrams are opening until the workspace loads', () => {
    render(<PreviewCanvas />);
    expect(screen.getByText('Opening your diagrams…')).toBeTruthy();
  });

  it('renders the diagram at its natural size and reports the status', async () => {
    await renderLoaded('flowchart TD\n  A');
    await waitFor(() => {
      expect(stageSvg()).not.toBeNull();
    });
    expect(stageSvg()?.getAttribute('width')).toBe('120');
    expect(stageSvg()?.style.maxWidth).toBe('none');
    expect(usePreviewStatusStore.getState()).toMatchObject({ validity: 'valid', renderMs: 7 });
  });

  it('shows the parse error, keeps the last good render and announces it', async () => {
    await renderLoaded('flowchart TD\n  A');
    await waitFor(() => {
      expect(stageSvg()).not.toBeNull();
    });
    renderDiagram.mockResolvedValue({
      kind: 'failed',
      error: { message: 'Parse error on line 2:\nExpecting NODE', line: 2 },
    });
    act(() => {
      useWorkspaceStore.getState().applyEdit('flowchart TD\n  A -->', {
        label: 'Typed in code',
        source: 'code',
      });
    });
    const notice = await screen.findByRole('region', { name: 'Parse error' });
    expect(within(notice).getByText('Parse error on line 2')).toBeTruthy();
    expect(within(notice).getByText('Showing the last good render.')).toBeTruthy();
    expect(stageSvg()).not.toBeNull();
    expect(document.querySelector('[aria-live="polite"]')?.textContent).toBe(
      'Parse error on line 2. Parse error on line 2:',
    );
  });

  it('invites an action when the diagram is empty', async () => {
    await renderLoaded('   ');
    fireEvent.click(screen.getByRole('button', { name: 'Open code' }));
    expect(useUiStore.getState().isCodeDrawerOpen).toBe(true);
    expect(renderDiagram).not.toHaveBeenCalled();
  });

  it('zooms, fits and toggles focus mode from the zoom bar and the palette', async () => {
    await renderLoaded('flowchart TD\n  A');
    const toolbar = screen.getByRole('toolbar', { name: 'Zoom' });
    fireEvent.click(within(toolbar).getByRole('button', { name: 'Zoom in' }));
    expect(within(toolbar).getByText('120%')).toBeTruthy();
    fireEvent.click(within(toolbar).getByRole('button', { name: 'Zoom out' }));
    fireEvent.click(within(toolbar).getByRole('button', { name: 'Zoom out' }));
    expect(within(toolbar).getByText('83%')).toBeTruthy();
    fireEvent.click(within(toolbar).getByRole('button', { name: 'Fit to view' }));
    expect(within(toolbar).getByText('100%')).toBeTruthy();
    const zoomIn = commandRegistry
      .getCommands()
      .find((command) => command.id === 'preview.zoom-in');
    act(() => {
      zoomIn?.run();
    });
    expect(within(toolbar).getByText('120%')).toBeTruthy();
    fireEvent.click(within(toolbar).getByRole('button', { name: 'Enter focus mode' }));
    expect(useFocusModeStore.getState().isFocusMode).toBe(true);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(useFocusModeStore.getState().isFocusMode).toBe(false);
  });

  it('reports a click on a shape, but not a drag', async () => {
    const onShapeClick = vi.fn();
    await renderLoaded('flowchart TD\n  A', onShapeClick);
    await waitFor(() => {
      expect(stageSvg()).not.toBeNull();
    });
    const rect = document.querySelector('rect');
    if (rect === null) {
      throw new Error('The test SVG has no rect.');
    }
    fireEvent.pointerDown(rect, { button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerUp(rect, { clientX: 10, clientY: 10 });
    expect(onShapeClick).toHaveBeenCalledWith(rect);
    fireEvent.pointerDown(rect, { button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(rect, { clientX: 60, clientY: 10 });
    fireEvent.pointerUp(rect, { clientX: 60, clientY: 10 });
    expect(onShapeClick).toHaveBeenCalledTimes(1);
  });

  it('by default selects the line of the clicked shape in the code drawer, leaving focus mode', async () => {
    await renderLoaded('flowchart TD\n  B --- A\n  A[Start]');
    await waitFor(() => {
      expect(stageSvg()).not.toBeNull();
    });
    useFocusModeStore.getState().setFocusMode(true);
    const rect = document.querySelector('rect');
    if (rect === null) {
      throw new Error('The test SVG has no rect.');
    }
    fireEvent.pointerDown(rect, { button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerUp(rect, { clientX: 10, clientY: 10 });
    const diagramId = useWorkspaceStore.getState().activeId;
    expect(useCodeRevealStore.getState().request).toEqual({ diagramId, line: 3 });
    expect(useUiStore.getState().isCodeDrawerOpen).toBe(true);
    expect(useFocusModeStore.getState().isFocusMode).toBe(false);
    useCodeRevealStore.setState({ request: null });
  });

  it('shows a viewed version instead of the current code, with its bar', async () => {
    await renderLoaded('flowchart TD\n  A');
    const version = {
      id: 'v1',
      diagramId: useWorkspaceStore.getState().activeId ?? '',
      code: 'flowchart TD\n  old',
      createdAt: Date.UTC(2026, 9, 9, 10, 42),
      kind: 'manual' as const,
      label: 'First draft',
      prompt: '',
    };
    act(() => {
      viewVersion(version);
    });
    const bar = screen.getByRole('region', { name: 'Viewed version' });
    expect(bar.textContent).toContain('First draft');
    await waitFor(() => {
      expect(usePreviewStatusStore.getState().diagramId).toBe('version:v1');
    });
    expect(renderDiagram).toHaveBeenLastCalledWith({ code: 'flowchart TD\n  old', isDark: false });
    fireEvent.click(within(bar).getByRole('button', { name: 'Compare with current' }));
    expect(useViewedVersionStore.getState().isCompareOpen).toBe(true);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(useViewedVersionStore.getState().version).toBeNull();
    expect(screen.queryByRole('region', { name: 'Viewed version' })).toBeNull();
  });
});
