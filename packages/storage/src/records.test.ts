import { describe, expect, it } from 'vitest';

import {
  chatMessageSchema,
  diagramPositionsSchema,
  diagramSchema,
  versionSchema,
} from './records.ts';

const diagram = {
  id: 'd1',
  title: 'Login flow',
  titleAuto: false,
  code: 'flowchart TD\n  A --> B',
  view: 'split',
  messages: [
    { role: 'user', text: 'draw a login flow', auto: false },
    {
      role: 'assistant',
      text: 'Done.',
      tools: ['Read'],
      streaming: false,
      meta: { durationMs: 1200, costUsd: null },
      review: { outcome: 'rejected', changes: 3 },
    },
  ],
  sessionId: null,
  pinned: true,
  draft: 'add a reset step',
  createdAt: 1,
  updatedAt: 2,
};

describe('record schemas', () => {
  it('accepts a full diagram', () => {
    expect(diagramSchema.parse(diagram)).toEqual(diagram);
  });

  it('rejects an unknown view and an unknown chat role', () => {
    expect(() => diagramSchema.parse({ ...diagram, view: 'code' })).toThrow();
    expect(() => chatMessageSchema.parse({ role: 'system', text: '' })).toThrow();
    const review = { outcome: 'ignored', changes: 1 };
    expect(() => chatMessageSchema.parse({ role: 'assistant', text: '', review })).toThrow();
  });

  it('accepts a version and rejects an unknown kind', () => {
    const version = {
      id: 'v1',
      diagramId: 'd1',
      code: 'pie',
      createdAt: 1,
      kind: 'restore',
      label: '',
      prompt: '',
    };
    expect(versionSchema.parse(version)).toEqual(version);
    expect(() => versionSchema.parse({ ...version, kind: 'auto' })).toThrow();
  });

  it('keeps extra position keys and rejects positions without coordinates', () => {
    const positions = { flow: { A: { x: 1, y: 2, width: 3 } } };
    expect(diagramPositionsSchema.parse(positions)).toEqual(positions);
    expect(() => diagramPositionsSchema.parse({ flow: { A: { x: 1 } } })).toThrow();
  });
});
