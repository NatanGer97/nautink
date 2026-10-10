import { describe, expect, it } from 'vitest';

import { parseInline, parseMarkdown } from './chat-markdown.ts';

describe('parseInline', () => {
  it('reads bold, italic, code and links, keeping the text between them', () => {
    expect(
      parseInline('I renamed **Pay** to `Charge` and *kept* [docs](https://x.dev/a).'),
    ).toEqual([
      { kind: 'text', text: 'I renamed ' },
      { kind: 'strong', children: [{ kind: 'text', text: 'Pay' }] },
      { kind: 'text', text: ' to ' },
      { kind: 'code', text: 'Charge' },
      { kind: 'text', text: ' and ' },
      { kind: 'em', children: [{ kind: 'text', text: 'kept' }] },
      { kind: 'text', text: ' ' },
      { kind: 'link', href: 'https://x.dev/a', children: [{ kind: 'text', text: 'docs' }] },
      { kind: 'text', text: '.' },
    ]);
  });

  it('nests italic in bold, and reads the underscore forms', () => {
    expect(parseInline('**a _b_**')).toEqual([
      {
        kind: 'strong',
        children: [
          { kind: 'text', text: 'a ' },
          { kind: 'em', children: [{ kind: 'text', text: 'b' }] },
        ],
      },
    ]);
    expect(parseInline('__x__')).toEqual([
      { kind: 'strong', children: [{ kind: 'text', text: 'x' }] },
    ]);
  });

  it('leaves unsafe links, lone stars and plain text as text', () => {
    expect(parseInline('[x](javascript:alert(1)) 2 * 3 = 6')).toEqual([
      { kind: 'text', text: '[x](javascript:alert(1)) 2 * 3 = 6' },
    ]);
    expect(parseInline('<b>hi</b>')).toEqual([{ kind: 'text', text: '<b>hi</b>' }]);
  });
});

describe('parseMarkdown', () => {
  it('splits paragraphs, headings, lists and code blocks', () => {
    const text = [
      '## Changes',
      'First line',
      'second line',
      '',
      '- one',
      '* two',
      '1. first',
      '2) second',
      '```ts',
      'const a = 1;',
      '```',
      'After.',
    ].join('\n');
    expect(parseMarkdown(text)).toEqual([
      { kind: 'heading', inlines: [{ kind: 'text', text: 'Changes' }] },
      { kind: 'paragraph', inlines: [{ kind: 'text', text: 'First line\nsecond line' }] },
      {
        kind: 'list',
        isOrdered: false,
        items: [[{ kind: 'text', text: 'one' }], [{ kind: 'text', text: 'two' }]],
      },
      {
        kind: 'list',
        isOrdered: true,
        items: [[{ kind: 'text', text: 'first' }], [{ kind: 'text', text: 'second' }]],
      },
      { kind: 'code', text: 'const a = 1;' },
      { kind: 'paragraph', inlines: [{ kind: 'text', text: 'After.' }] },
    ]);
  });

  it('keeps an unclosed code block to the end, and an empty text empty', () => {
    expect(parseMarkdown('```\nopen')).toEqual([{ kind: 'code', text: 'open' }]);
    expect(parseMarkdown('\n\n')).toEqual([]);
  });
});
