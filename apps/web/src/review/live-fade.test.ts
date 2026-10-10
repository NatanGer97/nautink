import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fadeInNewShapes, FADE_SECONDS, shapeKey, useLiveFade } from './live-fade.ts';
import { setMediaQuery } from '../../tests/media.ts';

const animateMock = vi.hoisted(() => vi.fn());

vi.mock('motion/mini', () => ({ animate: animateMock }));

afterEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = '';
});

describe('live fade', () => {
  function stage(html: string): HTMLElement {
    const root = document.createElement('div');
    root.innerHTML = html;
    document.body.append(root);
    return root;
  }

  it('fades in only the shapes it has not seen, and none with reduced motion', async () => {
    const root = stage('<div data-id="A"></div><div data-testid="sequence-item-i0"></div>');
    expect(shapeKey(root.firstElementChild!)).toBe('A');
    const seen = fadeInNewShapes(root, new Set(['A']));
    expect(seen).toEqual(new Set(['A', 'sequence-item-i0']));
    await vi.waitFor(() => {
      expect(animateMock).toHaveBeenCalledOnce();
    });
    expect(animateMock.mock.calls[0]?.[2]).toMatchObject({ duration: FADE_SECONDS });
    setMediaQuery('(prefers-reduced-motion: reduce)', true);
    fadeInNewShapes(root, new Set());
    await Promise.resolve();
    expect(animateMock).toHaveBeenCalledOnce();
    setMediaQuery('(prefers-reduced-motion: reduce)', false);
    const svg = stage('<svg><g id="r-flowchart-B-0" class="node"></g><g class="node"></g></svg>');
    expect(fadeInNewShapes(svg, new Set())).toEqual(new Set(['B']));
  });

  it('watches the canvas while the reply streams', async () => {
    const root = stage('<div data-id="A"></div>');
    const ref = { current: root };
    const { rerender, unmount } = renderHook(
      ({ isLive }: { isLive: boolean }) => {
        useLiveFade(ref, isLive);
      },
      { initialProps: { isLive: true } },
    );
    root.insertAdjacentHTML('beforeend', '<div data-id="B"></div>');
    await vi.waitFor(() => {
      expect(animateMock).toHaveBeenCalledOnce();
    });
    rerender({ isLive: false });
    unmount();
  });
});
