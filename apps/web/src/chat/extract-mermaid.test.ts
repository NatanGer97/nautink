import { describe, expect, it } from 'vitest';

import { extractMermaid, hasMermaidFence, stripMermaid } from './extract-mermaid.ts';

describe('extractMermaid', () => {
  it('returns the last closed block without its trailing newline', () => {
    const text =
      'First:\n```mermaid\nflowchart TD\n  A\n```\nThen:\n```mermaid title\nflowchart LR\n  B --> C\n```\nDone.';
    expect(extractMermaid(text)).toBe('flowchart LR\n  B --> C');
  });

  it('ignores an unclosed block unless partial blocks are allowed', () => {
    const text = 'Here it is:\n```mermaid\nflowchart TD\n  A --> B';
    expect(extractMermaid(text)).toBeNull();
    expect(extractMermaid(text, { isPartial: true })).toBe('flowchart TD\n  A --> B');
  });

  it('prefers the open block at the end when streaming after a closed one', () => {
    const text = '```mermaid\nflowchart TD\n```\nBetter:\n```mermaid\npie';
    expect(extractMermaid(text, { isPartial: true })).toBe('pie');
    expect(extractMermaid(text)).toBe('flowchart TD');
  });

  it('returns null without a mermaid block, and an empty string for a just-opened fence', () => {
    expect(extractMermaid('No diagram here.\n```js\nx\n```')).toBeNull();
    expect(extractMermaid('```mermaid\n', { isPartial: true })).toBe('');
  });
});

describe('stripMermaid and hasMermaidFence', () => {
  it('removes every block and keeps the prose', () => {
    const text = 'I added a step.\n```mermaid\nflowchart TD\n  A --> B\n```\n';
    expect(stripMermaid(text)).toBe('I added a step.');
    expect(stripMermaid('Working:\n```mermaid\nflowchart')).toBe('Working:');
    expect(hasMermaidFence(text)).toBe(true);
    expect(hasMermaidFence('Just text')).toBe(false);
  });
});
