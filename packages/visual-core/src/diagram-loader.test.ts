import { describe, expect, it } from 'vitest';

import { loadDiagram } from './diagram-loader.ts';

describe('loadDiagram', () => {
  it('returns the diagram', async () => {
    const diagram = { type: 'er', db: {} };
    expect(await loadDiagram('erDiagram', async () => Promise.resolve(diagram))).toEqual({
      kind: 'ok',
      diagram,
    });
  });

  it('turns a parse error into an error result', async () => {
    const result = await loadDiagram('x', async () => Promise.reject(new Error('Parse error')));
    expect(result).toEqual({ kind: 'error', message: 'Parse error' });
  });

  it('stringifies a thrown non-error', async () => {
    // eslint-disable-next-line prefer-promise-reject-errors, @typescript-eslint/prefer-promise-reject-errors -- Mermaid can throw strings
    const result = await loadDiagram('x', async () => Promise.reject('bad'));
    expect(result).toEqual({ kind: 'error', message: 'bad' });
  });
});
