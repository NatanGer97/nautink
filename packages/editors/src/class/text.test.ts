import { describe, expect, it } from 'vitest';

import {
  attrDisplay,
  attrFromText,
  attrSource,
  generics,
  idSource,
  methodDisplay,
  methodFromText,
  methodSource,
  noteFromEditor,
  noteLines,
  nsLeaf,
  nsParent,
  quoteSafe,
  readable,
} from './text.ts';

describe('entities', () => {
  it('makes source text readable', () => {
    expect(readable('#9829; #quot;a#quot; #colon; #nope;')).toBe('♥ "a" : #nope;');
    expect(readable('#constructor;')).toBe('#constructor;');
  });

  it('splits note lines and encodes inspector text', () => {
    expect(noteLines('a\\nb<br>c\nd')).toEqual(['a', 'b', 'c', 'd']);
    expect(quoteSafe('say "hi"')).toBe('say #quot;hi#quot;');
    expect(noteFromEditor('a "b"\nc')).toBe('a #quot;b#quot;\\nc');
  });
});

describe('generics', () => {
  it('turns tildes into angle brackets', () => {
    expect(generics('List~List~int~~')).toBe('List<List<int>>');
    expect(generics('Map~K, V~ x')).toBe('Map<K, V> x');
  });

  it('keeps the source when brackets would not balance', () => {
    expect(generics('~a')).toBe('~a');
    expect(generics('a~b')).toBe('a~b');
  });
});

describe('idSource', () => {
  it('quotes ids the grammar does not allow bare', () => {
    expect(idSource('Animal_1')).toBe('Animal_1');
    expect(idSource('My `Class`')).toBe('`My Class`');
  });
});

describe('member text', () => {
  it('reads attributes', () => {
    expect(attrFromText(' +String name ')).toEqual({ vis: '+', text: 'String name', cls: '' });
    expect(attrFromText('count$')).toEqual({ vis: '', text: 'count', cls: '$' });
    expect(attrFromText('a\nb')).toEqual({ vis: '', text: 'a b', cls: '' });
    expect(attrFromText('')).toEqual({ vis: '', text: '', cls: '' });
  });

  it('reads methods, with the classifier before or after the return type', () => {
    expect(methodFromText('+area(int w) double')).toEqual({
      vis: '+',
      name: 'area',
      params: 'int w',
      ret: 'double',
      cls: '',
    });
    expect(methodFromText('run()$ void')).toEqual({
      vis: '',
      name: 'run',
      params: '',
      ret: 'void',
      cls: '$',
    });
    expect(methodFromText('run() void*')).toEqual({
      vis: '',
      name: 'run',
      params: '',
      ret: 'void',
      cls: '*',
    });
    expect(methodFromText('no parens')).toBeNull();
  });

  it('writes and displays members', () => {
    expect(attrSource({ vis: '-', text: 'x', cls: '$' })).toBe('-x$');
    expect(methodSource({ vis: '#', name: 'f', params: 'a', ret: 'int', cls: '*' })).toBe(
      '#f(a)* int',
    );
    expect(methodSource({ vis: '', name: 'f', params: '', ret: '', cls: '' })).toBe('f()');
    expect(attrDisplay({ vis: '+', text: 'List~int~ #quot;x#quot;', cls: '' })).toBe(
      'List<int> "x"',
    );
    expect(methodDisplay({ vis: '', name: 'get', params: 'K~T~ k', ret: 'V~T~', cls: '' })).toBe(
      'get(K<T> k) : V<T>',
    );
    expect(methodDisplay({ vis: '', name: 'go', params: '', ret: '', cls: '' })).toBe('go()');
  });
});

describe('namespace ids', () => {
  it('splits dotted ids', () => {
    expect(nsParent('a.b.c')).toBe('a.b');
    expect(nsParent('a')).toBe('');
    expect(nsLeaf('a.b.c')).toBe('c');
    expect(nsLeaf('a')).toBe('a');
  });
});
