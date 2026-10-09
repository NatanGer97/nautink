import { describe, expect, it } from 'vitest';

import { autoTitle, codeTitle, frontMatterTitle, trimTitle } from './auto-title.ts';

import type { AutoTitleSource } from './auto-title.ts';

const OCT_9: number = Date.UTC(2026, 9, 9, 12);

function source(code: string, messages: AutoTitleSource['messages'] = []): AutoTitleSource {
  return { code, messages, createdAt: OCT_9 };
}

describe('autoTitle', () => {
  it('falls back to the type and creation date', () => {
    expect(autoTitle(source('flowchart TD\n  A --> B'))).toBe('Flowchart · Oct 9');
    expect(autoTitle(source('sequenceDiagram\n  A->>B: hi'))).toBe('Sequence · Oct 9');
    expect(autoTitle(source(''))).toBe('Empty · Oct 9');
  });

  it('reads a pie title from the header line', () => {
    expect(autoTitle(source('pie title Pets adopted\n  "Dogs": 386'))).toBe('Pets adopted');
    expect(autoTitle(source('pie showData title  Key elements \n  "A": 1'))).toBe('Key elements');
  });

  it('reads a pie or gantt title from a title line', () => {
    expect(autoTitle(source('pie\n  title Budget\n  "Rent": 50'))).toBe('Budget');
    const gantt =
      'gantt\n  dateFormat YYYY-MM-DD\n  title Launch plan\n  section A\n  Task :a1, 2026-01-01, 3d';
    expect(autoTitle(source(gantt))).toBe('Launch plan');
  });

  it('ignores title lines in other diagram types and untitled pies', () => {
    expect(codeTitle('flowchart TD\n  title Not a title')).toBe('');
    expect(autoTitle(source('pie\n  "A": 1'))).toBe('Pie · Oct 9');
  });

  it('prefers front matter, then the code title, then the first typed message', () => {
    const messages: AutoTitleSource['messages'] = [
      { role: 'user', text: 'fix it', auto: true },
      { role: 'assistant', text: 'Sure' },
      { role: 'user', text: '  draw the   login flow ' },
    ];
    expect(autoTitle(source('---\ntitle: "Front"\n---\npie title Code', messages))).toBe('Front');
    expect(autoTitle(source('pie title Code', messages))).toBe('Code');
    expect(autoTitle(source('flowchart TD', messages))).toBe('draw the login flow');
  });

  it('cuts long titles', () => {
    const long = 'x'.repeat(60);
    expect(autoTitle(source(`pie title ${long}`))).toBe(`${'x'.repeat(47)}…`);
  });
});

describe('title helpers', () => {
  it('reads front matter titles, quoted or not', () => {
    expect(frontMatterTitle("---\ntitle: 'Quoted'\n---\nflowchart TD")).toBe('Quoted');
    expect(frontMatterTitle('---\ntheme: dark\n---\nflowchart TD')).toBe('');
    expect(frontMatterTitle('flowchart TD')).toBe('');
  });

  it('trims to one line with an ellipsis', () => {
    expect(trimTitle(' a\n b ')).toBe('a b');
    expect(trimTitle('abcdef', 4)).toBe('abc…');
  });
});
