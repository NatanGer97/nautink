import 'fake-indexeddb/auto';
import { cleanup } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, vi } from 'vitest';

import { installLocalBroadcastChannel } from './broadcast.ts';
import { resetHistoryState, skipFirstRun } from './history-fixtures.ts';
import { installMatchMedia, resetMediaQueries } from './media.ts';
import { resetChatState } from '../src/chat/chat-store.ts';
import { resetCanvasSelection } from '../src/edit/selection/canvas-selection.ts';
import { resetRepoState } from '../src/settings/repo-store.ts';
import { resetUiState } from '../src/state/ui-store.ts';
import { useWorkspaceStore } from '../src/workspace/use-workspace.ts';

// jsdom lacks the layout APIs Radix, cmdk and react-resizable-panels measure with.
class ResizeObserverStub {
  observe(): undefined {
    return undefined;
  }

  unobserve(): undefined {
    return undefined;
  }

  disconnect(): undefined {
    return undefined;
  }
}

// Never reports an intersection, so lazy thumbnails stay unrendered unless a test asks for them.
class IntersectionObserverStub extends ResizeObserverStub {
  readonly root: null = null;
  readonly rootMargin: string = '';
  readonly thresholds: readonly number[] = [];

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

globalThis.ResizeObserver = ResizeObserverStub;
globalThis.IntersectionObserver = IntersectionObserverStub;
Element.prototype.scrollIntoView = (): undefined => undefined;
Element.prototype.hasPointerCapture = (): boolean => false;
Element.prototype.releasePointerCapture = (): undefined => undefined;
Element.prototype.setPointerCapture = (): undefined => undefined;
installMatchMedia();
installLocalBroadcastChannel();

// Mermaid cannot lay out diagrams in jsdom (no SVG geometry) and is slow to import, so every test
// that mounts the app gets a renderer that answers at once. `render-diagram.test.ts` unmocks it.
vi.mock('../src/preview/render-diagram.ts', () => ({
  renderDiagram: async (): Promise<unknown> =>
    Promise.resolve({ kind: 'rendered', svg: '<svg viewBox="0 0 10 10"></svg>', renderMs: 1 }),
}));

beforeEach(() => {
  // A fresh, empty IndexedDB per test, so the app's `nautink` database never leaks between tests.
  globalThis.indexedDB = new IDBFactory();
  window.localStorage.clear();
  // Most tests start in the workspace; the first-run tests clear this flag themselves.
  skipFirstRun();
  resetMediaQueries();
  resetUiState();
  resetChatState();
  resetRepoState();
});

afterEach(() => {
  cleanup();
  useWorkspaceStore.getState().reset();
  resetHistoryState();
  resetCanvasSelection();
});
