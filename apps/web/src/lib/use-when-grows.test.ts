import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useWhenGrows } from './use-when-grows.ts';

describe('useWhenGrows', () => {
  it('runs only when the value gets larger, never on the first render', async () => {
    const onGrow = vi.fn();
    const { rerender } = renderHook(
      ({ value }: { value: number }) => {
        useWhenGrows(value, onGrow);
      },
      { initialProps: { value: 0 } },
    );
    rerender({ value: 0 });
    rerender({ value: 118 });
    await waitFor(() => {
      expect(onGrow).toHaveBeenCalledTimes(1);
    });
    rerender({ value: 118 });
    rerender({ value: 0 });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(onGrow).toHaveBeenCalledTimes(1);
  });
});
