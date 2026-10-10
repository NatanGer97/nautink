import { describe, expect, it } from 'vitest';

import { parseFlow } from '../scripts/flow-parser.ts';
import { scopeViolations } from '../scripts/selection-scope.ts';

// The checker behind `scripts/selection-check.ts` (PRD §4.1 "done when"), on fixed diagrams: no
// Claude, so the result never changes.

const BEFORE = [
  'flowchart TD',
  '  A[Cart] --> B[Pay]',
  '  B --> C[Done]',
  '  C --> D[Mail]',
  '  E[Audit]',
].join('\n');

async function violations(after: string, selected: string[] = ['B']): Promise<string[]> {
  return scopeViolations({
    before: await parseFlow(BEFORE),
    after: await parseFlow(after),
    selected,
  });
}

function edit(...lines: string[]): string {
  return ['flowchart TD', ...lines].join('\n');
}

describe('scopeViolations', () => {
  it('passes an unchanged diagram', async () => {
    expect(await violations(BEFORE)).toEqual([]);
  });

  it('passes a renamed, reshaped or restyled selected node', async () => {
    const after = edit(
      '  A[Cart] --> B(Charge card)',
      '  B --> C[Done]',
      '  C --> D[Mail]',
      '  E[Audit]',
    );
    expect(await violations(after)).toEqual([]);
    const styled = `${BEFORE}\n  classDef hot fill:#f00\n  class B hot\n  style B stroke-width:2px`;
    expect(await violations(styled)).toEqual([]);
  });

  it('fails a change to a node that is not selected', async () => {
    const after = edit(
      '  A[Basket] --> B[Pay]',
      '  B --> C[Done]',
      '  C --> D[Mail]',
      '  E[Audit]',
    );
    expect(await violations(after)).toEqual(['changed node A']);
  });

  it('passes deleting the selection with its links', async () => {
    expect(await violations(edit('  A[Cart]', '  C[Done] --> D[Mail]', '  E[Audit]'))).toEqual([]);
  });

  it('fails deleting a node that is not selected', async () => {
    const after = edit('  A[Cart] --> B[Pay]', '  B --> C[Done]', '  C[Done]', '  E[Audit]');
    expect(await violations(after)).toEqual(['removed node D', 'removed link C → D']);
  });

  it('passes a new step after the selection, and a replacement for it', async () => {
    const inserted = edit(
      '  A[Cart] --> B[Pay]',
      '  B --> T[Timeout]',
      '  T --> C[Done]',
      '  C --> D[Mail]',
      '  E[Audit]',
    );
    expect(await violations(inserted)).toEqual([]);
    const replaced = edit(
      '  A[Cart] --> X[Charge]',
      '  X --> C[Done]',
      '  C --> D[Mail]',
      '  E[Audit]',
    );
    expect(await violations(replaced)).toEqual([]);
  });

  it('fails a new node away from the selection', async () => {
    const after = `${BEFORE}\n  D --> F[Archive]\n  G[Loose]`;
    expect(await violations(after)).toEqual([
      'added unrelated node F',
      'added unrelated node G',
      'added link D → F',
    ]);
  });

  it('fails a link change between nodes that are not selected', async () => {
    const after = edit('  A[Cart] --> B[Pay]', '  B --> C[Done]', '  C -.-> D[Mail]', '  E[Audit]');
    expect(await violations(after)).toEqual(['removed link C → D', 'added link C → D']);
  });

  it('passes a new group of selected nodes, and fails one that takes in others', async () => {
    const grouped = `${BEFORE}\n  subgraph pay [Payment]\n    B\n  end`;
    expect(await violations(grouped)).toEqual([]);
    const wider = `${BEFORE}\n  subgraph pay [Payment]\n    B\n    E\n  end`;
    expect(await violations(wider)).toEqual(['changed group pay']);
  });

  it('fails a retitled group unless it is selected', async () => {
    const before = `${BEFORE}\n  subgraph g [Tail]\n    D\n  end`;
    const after = `${BEFORE}\n  subgraph g [End]\n    D\n  end`;
    const check = async (selected: string[]): Promise<string[]> =>
      scopeViolations({ before: await parseFlow(before), after: await parseFlow(after), selected });
    expect(await check(['B'])).toEqual(['changed group g']);
    expect(await check(['g'])).toEqual([]);
  });

  it('fails a style line for another node, the direction and the front matter', async () => {
    expect(await violations(`${BEFORE}\n  style E fill:#eee`)).toEqual([
      'changed line "style E fill:#eee"',
    ]);
    expect(await violations(BEFORE.replace('TD', 'LR'))).toEqual(['changed the direction']);
    expect(await violations(`---\ntitle: Shop\n---\n${BEFORE}`)).toEqual([
      'changed the front matter',
    ]);
  });
});

describe('parseFlow', () => {
  it('throws on code that is not a flowchart', async () => {
    await expect(parseFlow('sequenceDiagram\n  A->>B: hi')).rejects.toThrow(
      'Not a valid flowchart',
    );
  });
});
