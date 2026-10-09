import { describe, expect, it } from 'vitest';

import { clip, decodeText, quoteLabel } from './text.ts';

describe('clip', () => {
  it('flattens line breaks and whitespace', () => {
    expect(clip('a<br/>b\n\n c')).toBe('a b c');
  });

  it('shortens long text with an ellipsis', () => {
    expect(clip('abcdefghij', 5)).toBe('abcd…');
    expect(clip('abcde', 5)).toBe('abcde');
  });

  it('defaults to 40 characters', () => {
    expect(clip('x'.repeat(41))).toHaveLength(40);
  });
});

describe('decodeText', () => {
  it('turns Mermaid placeholders back into entities and text', () => {
    expect(decodeText('Say ﬂ°quot¶ßhiﬂ°quot¶ß')).toBe('Say "hi"');
    expect(decodeText('ﬂ°°9829¶ß')).toBe('♥');
  });

  it('decodes &quot; and #quot;', () => {
    expect(decodeText('&quot;a#quot;')).toBe('"a"');
  });

  it('keeps other named entities', () => {
    expect(decodeText('ﬂ°amp¶ß')).toBe('&amp;');
  });
});

describe('quoteLabel', () => {
  it('keeps plain labels bare', () => {
    expect(quoteLabel('Save to DB')).toBe('Save to DB');
    expect(quoteLabel("Don't stop, ok?")).toBe("Don't stop, ok?");
  });

  it('quotes labels with grammar characters', () => {
    expect(quoteLabel('a(b)')).toBe('"a(b)"');
    expect(quoteLabel('say "hi"')).toBe('"say #quot;hi#quot;"');
    expect(quoteLabel('-lead')).toBe('"-lead"');
    expect(quoteLabel('a -- b')).toBe('"a -- b"');
  });

  it('quotes flowchart keywords', () => {
    expect(quoteLabel('end')).toBe('"end"');
    expect(quoteLabel('Subgraph')).toBe('"Subgraph"');
  });
});
