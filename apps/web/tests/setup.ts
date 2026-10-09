import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';

import { installMatchMedia, resetMediaQueries } from './media.ts';
import { resetUiState } from '../src/state/ui-store.ts';

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
installMatchMedia();

beforeEach(() => {
  window.localStorage.clear();
  resetMediaQueries();
  resetUiState();
});

afterEach(() => {
  cleanup();
});
