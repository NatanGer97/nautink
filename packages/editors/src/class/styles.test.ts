import { describe, expect, it } from 'vitest';

import { emptyModel } from './model.ts';
import { classStyles, luminance } from './styles.ts';

import type { ClassItem, ClassModel } from './types.ts';

const item = (id: string, css: string[] = []): ClassItem => ({
  id,
  label: '',
  generic: '',
  annotations: [],
  attrs: [],
  methods: [],
  css,
  ns: '',
});

describe('luminance', () => {
  it('reads 3- and 6-digit hex colors', () => {
    expect(luminance('#fff')).toBeCloseTo(1);
    expect(luminance('000000')).toBe(0);
    expect(luminance('red')).toBeNull();
  });
});

describe('classStyles', () => {
  it('layers default, class definitions and style lines', () => {
    const model: ClassModel = {
      ...emptyModel(),
      classes: [item('A', ['hot']), item('B'), item('C')],
      extra: [
        'classDef default stroke:#111',
        'classDef hot,warm fill:#fff, color:#123',
        'classDef cool fill:#000',
        'cssClass "B, C" cool',
        'style C stroke-width:2px,stroke-dasharray: 5 5;',
        'classDef broken',
        'style',
      ],
    };
    expect(classStyles(model)).toEqual({
      A: { '--node-fill': '#fff', '--cls-head': '#fff', '--node-stroke': '#111', color: '#123' },
      B: { '--node-fill': '#000', '--cls-head': '#000', '--node-stroke': '#111', color: '#f2f3f5' },
      C: {
        '--node-fill': '#000',
        '--cls-head': '#000',
        '--node-stroke': '#111',
        color: '#f2f3f5',
        borderWidth: '2px',
        borderStyle: 'dashed',
      },
    });
  });

  it('picks dark text on light fills and skips unstyled classes', () => {
    const model: ClassModel = {
      ...emptyModel(),
      classes: [item('A'), item('B')],
      extra: ['style A fill:#eee', 'style B fill:blue', 'cssClass "Z" x'],
    };
    expect(classStyles(model)).toEqual({
      A: { '--node-fill': '#eee', '--cls-head': '#eee', color: '#1c1f24' },
      B: { '--node-fill': 'blue', '--cls-head': 'blue' },
    });
    expect(classStyles({ ...emptyModel(), classes: [item('A')] })).toEqual({});
  });
});
