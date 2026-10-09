import { describe, expect, it } from 'vitest';

import { isCssColor } from './css-colors.ts';
import { decode, displayText, esc } from './text.ts';

describe('sequence text', () => {
  it('decodes db text, keeping named entities in Mermaid form', () => {
    expect(decode('ﬂ°°9829¶ß ﬂ°amp¶ß')).toBe('♥ #amp;');
    expect(decode(undefined)).toBe('');
  });

  it('escapes characters the grammar cannot hold', () => {
    expect(esc('a;b#c #quot; x\ny')).toBe('a#59;b#35;c #quot; x<br>y');
  });

  it('turns entities and breaks into display text', () => {
    expect(displayText('a<br/>b #9829; #quot;q#quot; #nope;')).toBe('a\nb ♥ "q" #nope;');
  });
});

describe('isCssColor', () => {
  it('knows named, hex and functional colors', () => {
    expect(isCssColor('Purple')).toBe(true);
    expect(isCssColor('transparent')).toBe(true);
    expect(isCssColor('#abc')).toBe(true);
    expect(isCssColor('rgb(1,2,3)')).toBe(true);
    expect(isCssColor('Team')).toBe(false);
    expect(isCssColor('#abcde')).toBe(false);
  });
});
