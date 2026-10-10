import { describe, expect, it } from 'vitest';

import { classElements } from './class-review.ts';
import { erElements } from './er-review.ts';
import { flowElements } from './flow-review.ts';
import { alignRows, rowKey, sequenceElements, sequenceUnion } from './sequence-review.ts';
import { stateUnion } from './state-review.ts';
import { parseOk } from '../../tests/parse-ok.ts';
import { emptyModel as emptyClass } from '../class/model.ts';
import { emptyModel as emptyEr } from '../er/model.ts';
import { emptyModel as emptyFlow } from '../flow/model.ts';
import { parse as parseSequence, serialize as serializeSequence } from '../sequence/model.ts';
import { parse as parseState } from '../state/model.ts';

describe('element labels', () => {
  it('falls back to ids and ends when there is no label', () => {
    const flow = flowElements({
      ...emptyFlow(),
      nodes: [{ id: 'A', label: '', shape: 'rect', classes: [], icon: 'mdi:home' }],
    });
    expect(flow[0]?.label).toBe('A');
    const er = erElements({
      ...emptyEr(),
      entities: [{ name: 'CAR', alias: 'Car', attributes: [], classes: [] }],
      rels: [
        {
          id: 'R_CAR_CAR_0',
          from: 'CAR',
          to: 'CAR',
          fromCard: 'ONLY_ONE',
          toCard: 'ONLY_ONE',
          isIdentifying: true,
          label: '',
        },
      ],
    });
    expect(er.map((element) => element.label)).toEqual(['Car', 'CAR → CAR']);
    const classes = classElements({
      ...emptyClass(),
      classes: [
        {
          id: 'A',
          label: '',
          generic: '',
          annotations: [],
          attrs: [],
          methods: [],
          css: [],
          ns: '',
        },
      ],
    });
    expect(classes[0]?.label).toBe('A');
  });
});

describe('sequence rows', () => {
  it('keys every row kind, and names a block without a label by its kind', async () => {
    const model = await parseOk(
      parseSequence,
      [
        'sequenceDiagram',
        '  A->>B: one',
        '  autonumber',
        '  activate A',
        '  opt',
        '    B->>A: two',
        '  end',
      ].join('\n'),
    );
    expect(model.items.map(rowKey)).toEqual([
      'message:A>B',
      'autonumber',
      'activation:A:true',
      'block:opt',
    ]);
    expect(sequenceElements(model).map((element) => element.label)).toEqual([
      'A',
      'B',
      'one',
      'opt',
      'two',
    ]);
  });

  it('aligns two row lists along their common rows', () => {
    expect(alignRows(['a', 'b', 'c'], ['a', 'x', 'c'])).toEqual([
      'both',
      'before',
      'after',
      'both',
    ]);
  });

  it('drops activations inside a removed block, and merges an added section', async () => {
    const before = await parseOk(
      parseSequence,
      [
        'sequenceDiagram',
        '  alt yes',
        '    A->>B: go',
        '  end',
        '  loop',
        '    activate A',
        '    A->>B: ping',
        '    deactivate A',
        '  end',
      ].join('\n'),
    );
    const after = await parseOk(
      parseSequence,
      [
        'sequenceDiagram',
        '  alt yes',
        '    A->>B: go',
        '  else no',
        '    B->>A: stop',
        '  end',
      ].join('\n'),
    );
    const code: string = serializeSequence(sequenceUnion(before, after));
    expect(code).toContain('else no');
    expect(code).toContain('ping');
    expect(code).not.toContain('activate');
  });
});

describe('state ghosts', () => {
  it('moves a ghost to the top level when its composite is no longer one', async () => {
    const before = await parseOk(parseState, 'stateDiagram-v2\n  state P {\n    A\n  }');
    const after = await parseOk(parseState, 'stateDiagram-v2\n  P');
    const union = stateUnion(before, after);
    expect(union.states.find((state) => state.id === 'A')?.parent).toBeNull();
  });
});
