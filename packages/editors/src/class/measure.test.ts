import { approximateTextWidth } from '@nautink/visual-core/text-measure';
import { describe, expect, it } from 'vitest';

import { classSize, className, FONT, MAX_W, MIN_W, noteSize } from './measure.ts';

import type { ClassItem } from './types.ts';

const measure = (text: string): number => approximateTextWidth(text);
const item: ClassItem = {
  id: 'A',
  label: '',
  generic: '',
  annotations: [],
  attrs: [],
  methods: [],
  css: [],
  ns: '',
};

describe('className', () => {
  it('shows the label or id with generics', () => {
    expect(className(item)).toBe('A');
    expect(className({ ...item, label: 'Shape #quot;x#quot;', generic: 'List~T~' })).toBe(
      'Shape "x"<List<T>>',
    );
  });
});

describe('classSize', () => {
  it('gives an empty class the minimum box', () => {
    expect(classSize(item, measure)).toEqual({ width: MIN_W, height: 51 });
  });

  it('grows with members and annotations, up to the maximum width', () => {
    const full: ClassItem = {
      ...item,
      annotations: ['interface'],
      attrs: [{ vis: '+', text: 'x'.repeat(100), cls: '' }],
      methods: [{ vis: '', name: 'f', params: '', ret: '', cls: '' }],
    };
    expect(classSize(full, measure)).toEqual({ width: MAX_W, height: 102 });
  });

  it('measures text in the class fonts', () => {
    const fonts: string[] = [];
    classSize(
      { ...item, annotations: ['a'], attrs: [{ vis: '', text: 'x', cls: '' }] },
      (text, font) => {
        fonts.push(font);
        return text.length;
      },
    );
    expect(fonts).toEqual([FONT.name, FONT.stereo, FONT.member]);
  });
});

describe('noteSize', () => {
  it('sizes a note from its lines', () => {
    expect(noteSize({ id: 'n', text: 'hi', for: '', ns: '' }, measure)).toEqual({
      width: 90,
      height: 37,
    });
    expect(noteSize({ id: 'n', text: `${'x'.repeat(60)}\\nb`, for: '', ns: '' }, measure)).toEqual({
      width: 320,
      height: 54,
    });
  });
});
