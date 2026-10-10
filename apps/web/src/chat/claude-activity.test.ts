import { describe, expect, it } from 'vitest';

import { DRAWING, THINKING, WRITING, activityStep, elapsedSeconds } from './claude-activity.ts';

describe('activityStep', () => {
  it('says Claude is thinking before anything arrives', () => {
    expect(activityStep(undefined)).toBe(THINKING);
    expect(activityStep({ role: 'assistant', text: '  ', streaming: true })).toBe(THINKING);
  });

  it('names the newest tool step first', () => {
    const message = { role: 'assistant', text: 'Hi', tools: ['Read a.ts', 'Grep "x"'] } as const;
    expect(activityStep({ ...message, tools: [...message.tools] })).toBe('Grep "x"');
  });

  it('tells writing prose apart from drawing the diagram', () => {
    expect(activityStep({ role: 'assistant', text: 'I will add a step.' })).toBe(WRITING);
    expect(activityStep({ role: 'assistant', text: 'Here:\n```mermaid\nflowchart TD' })).toBe(
      DRAWING,
    );
  });
});

describe('elapsedSeconds', () => {
  it('counts whole seconds and never goes below zero', () => {
    expect(elapsedSeconds(1_000, 3_999)).toBe(2);
    expect(elapsedSeconds(5_000, 4_000)).toBe(0);
  });
});
