import { describe, expect, it } from 'vitest';

import { reviewDiagram } from './review-diagram.ts';
import { loadMermaid } from '../../tests/mermaid-loader.ts';

import type { DiagramReview, StructuralReview } from './review-diagram.ts';
import type { DiagramLoader } from '@nautink/visual-core/editor-contract';

async function structural(before: string, after: string): Promise<StructuralReview> {
  const review: DiagramReview = await reviewDiagram({ before, after, load: loadMermaid });
  if (review.kind !== 'structural') {
    throw new Error(`Expected a structural review: ${review.reason}`);
  }
  return review;
}

function marks(review: StructuralReview): string[] {
  return review.targets.map((target) => `${target.mark} ${target.kind} ${target.id}`);
}

describe('reviewDiagram: flowchart', () => {
  const before = 'flowchart TD\n  A[Start] --> B\n  B --> C\n  subgraph G\n    C\n  end';
  const after = 'flowchart TD\n  A[Begin] --> B\n  B --> D';

  it('counts and marks added, changed and removed nodes, links and subgraphs', async () => {
    const review = await structural(before, after);
    expect(review.counts).toEqual({ added: 2, changed: 1, removed: 3 });
    expect(marks(review)).toEqual([
      'changed node A',
      'added node D',
      'removed node C',
      'removed group G',
      'added edge L_B_D_0',
      'removed edge L_B_C_0',
    ]);
    expect(review.code).toContain('subgraph G');
  });

  it('shows the proposal as written when nothing was removed', async () => {
    const review = await structural('flowchart TD\n  A', 'flowchart TD\n  A --> B');
    expect(review.code).toBe('flowchart TD\n  A --> B');
    expect(review.counts).toEqual({ added: 2, changed: 0, removed: 0 });
  });

  it('treats a diagram of another type, or one that does not parse, as empty', async () => {
    const fromPie = await structural('pie\n  "a" : 1', 'flowchart TD\n  A');
    expect(fromPie.counts).toEqual({ added: 1, changed: 0, removed: 0 });
    const fromBroken = await structural('flowchart TD\n  A -->', 'flowchart TD\n  A');
    expect(marks(fromBroken)).toEqual(['added node A']);
  });

  it('falls back to the proposal when the merged diagram does not parse', async () => {
    let calls = 0;
    const load: DiagramLoader = async (code) => {
      calls += 1;
      if (calls === 3) {
        throw new Error('Merged diagram rejected.');
      }
      return loadMermaid(code);
    };
    const review = await reviewDiagram({ before, after, load });
    expect(review.kind === 'structural' && review.code).toBe(after);
    expect(review.kind === 'structural' && marks(review)).toEqual([
      'changed node A',
      'added node D',
      'added edge L_B_D_0',
    ]);
  });
});

describe('reviewDiagram: code only', () => {
  it('reviews a type without a visual editor as code', async () => {
    const review = await reviewDiagram({ before: '', after: 'pie\n  "a" : 1', load: loadMermaid });
    expect(review).toEqual({ kind: 'code', reason: 'This diagram type has no visual editor.' });
  });

  it('reviews a proposal that does not parse as code, with the reason', async () => {
    const review = await reviewDiagram({
      before: 'flowchart TD',
      after: 'flowchart TD\n  A -->',
      load: loadMermaid,
    });
    expect(review.kind).toBe('code');
  });
});

describe('reviewDiagram: class', () => {
  it('marks classes, relations and notes, and keeps removed ones as ghosts', async () => {
    const before =
      'classDiagram\n  class Order {\n    +id int\n  }\n  Order --> Item\n  Order --> Gone\n  note for Gone "bye"';
    const after =
      'classDiagram\n  class Order {\n    +id int\n    +pay()\n  }\n  Order --> Item : has\n  note for Item "hi"';
    const review = await structural(before, after);
    expect(review.counts).toEqual({ added: 1, changed: 2, removed: 3 });
    expect(marks(review)).toEqual([
      'changed node Order',
      'removed node Gone',
      'changed edge R:Order:Item:0',
      'removed edge R:Order:Gone:0',
      'added note note:Item:0',
      'removed note note:Gone:0',
    ]);
  });
});

describe('reviewDiagram: ER', () => {
  it('marks entities and relationships', async () => {
    const before =
      'erDiagram\n  CUSTOMER ||--o{ ORDER : places\n  ORDER ||--|{ LINE : has\n  LINE { int qty }';
    const after = 'erDiagram\n  CUSTOMER ||--o{ ORDER : makes\n  ORDER { int id }';
    const review = await structural(before, after);
    expect(marks(review)).toEqual([
      'changed node ORDER',
      'removed node LINE',
      'changed edge R_CUSTOMER_ORDER_0',
      'removed edge R_ORDER_LINE_0',
    ]);
  });
});

describe('reviewDiagram: state', () => {
  it('marks states, transitions and notes; a ghost whose composite is gone moves to the top', async () => {
    const before =
      'stateDiagram-v2\n  [*] --> Idle\n  Idle --> Busy : go\n  state Busy {\n    Work --> Rest\n  }\n  note right of Idle : wait';
    const after =
      'stateDiagram-v2\n  [*] --> Idle\n  Idle --> Done : go\n  note right of Idle : hold';
    const review = await structural(before, after);
    expect(review.counts).toEqual({ added: 2, changed: 1, removed: 5 });
    expect(marks(review)).toEqual([
      'removed node Busy',
      'removed node Work',
      'removed node Rest',
      'added node Done',
      'removed edge t0',
      'added edge t2',
      'removed edge t3',
      'changed note note:Idle:0',
    ]);
    expect(review.code).toContain('state Busy');
  });

  it('keeps a ghost in a concurrent region that still exists', async () => {
    const before = 'stateDiagram-v2\n  state P {\n    A\n    --\n    B\n  }';
    const after = 'stateDiagram-v2\n  state P {\n    A\n    --\n    C\n  }';
    const review = await structural(before, after);
    expect(marks(review)).toEqual(['added node C', 'removed node B']);
  });
});

describe('reviewDiagram: sequence', () => {
  const before = [
    'sequenceDiagram',
    '  participant A',
    '  participant B',
    '  box Team',
    '    participant C',
    '  end',
    '  A->>+B: hello',
    '  loop every second',
    '    B->>C: ping',
    '    Note over C: busy',
    '  end',
    '  activate A',
    '  B-->>-A: bye',
    '  deactivate A',
  ].join('\n');

  it('keeps removed rows where they stood, without their activations', async () => {
    const after = [
      'sequenceDiagram',
      '  participant A',
      '  participant B',
      '  A->>B: hi',
      '  loop every second',
      '    B->>A: pong',
      '  end',
      '  B->>A: new',
    ].join('\n');
    const review = await structural(before, after);
    expect(review.counts).toEqual({ added: 1, changed: 2, removed: 3 });
    expect(review.targets.map((target) => `${target.mark} ${target.kind} ${target.label}`)).toEqual(
      [
        'removed participant C',
        'changed message hi',
        'removed message ping',
        'removed note busy',
        'changed message pong',
        'added message new',
      ],
    );
    expect(review.code.indexOf('ping')).toBeLessThan(review.code.indexOf('pong'));
  });

  it('keeps a whole removed block as a ghost, and a ghost participant in a box that stays', async () => {
    const after = [
      'sequenceDiagram',
      '  participant A',
      '  box Team',
      '    participant C',
      '  end',
      '  A->>C: hello',
    ].join('\n');
    const review = await structural(before, after);
    const removed = review.targets.filter((target) => target.mark === 'removed');
    expect(removed.map((target) => `${target.kind} ${target.label}`)).toEqual([
      'participant B',
      'message hello',
      'group every second',
      'message ping',
      'note busy',
      'message bye',
    ]);
    expect(review.code).toContain('box Team');
  });
});
