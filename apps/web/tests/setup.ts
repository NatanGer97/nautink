import 'fake-indexeddb/auto';
import { cleanup } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach } from 'vitest';

import { installLocalBroadcastChannel } from './broadcast.ts';
import { resetHistoryState } from './history-fixtures.ts';
import { installMatchMedia, resetMediaQueries } from './media.ts';
import { resetChatState } from '../src/chat/chat-store.ts';
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

globalThis.ResizeObserver = ResizeObserverStub;
Element.prototype.scrollIntoView = (): undefined => undefined;
Element.prototype.hasPointerCapture = (): boolean => false;
Element.prototype.releasePointerCapture = (): undefined => undefined;
Element.prototype.setPointerCapture = (): undefined => undefined;
installMatchMedia();
installLocalBroadcastChannel();

beforeEach(() => {
  // A fresh, empty IndexedDB per test, so the app's `nautink` database never leaks between tests.
  globalThis.indexedDB = new IDBFactory();
  window.localStorage.clear();
  resetMediaQueries();
  resetUiState();
  resetChatState();
  resetRepoState();
});

afterEach(() => {
  cleanup();
  useWorkspaceStore.getState().reset();
  resetHistoryState();
});
