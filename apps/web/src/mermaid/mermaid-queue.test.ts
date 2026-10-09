import { describe, expect, it } from 'vitest';

import { enqueueMermaid } from './mermaid-queue.ts';

describe('enqueueMermaid', () => {
  it('runs jobs one at a time, in order', async () => {
    const log: string[] = [];
    const slow = enqueueMermaid(async () => {
      log.push('slow start');
      await new Promise((resolve) => setTimeout(resolve, 20));
      log.push('slow end');
      return 1;
    });
    const fast = enqueueMermaid(() => {
      log.push('fast');
      return 2;
    });
    expect(await Promise.all([slow, fast])).toEqual([1, 2]);
    expect(log).toEqual(['slow start', 'slow end', 'fast']);
  });

  it('keeps going after a job fails, and hands the failure to its caller', async () => {
    const failing = enqueueMermaid(() => {
      throw new Error('boom');
    });
    const next = enqueueMermaid(() => 'ok');
    await expect(failing).rejects.toThrow('boom');
    await expect(next).resolves.toBe('ok');
  });
});
