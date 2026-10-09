import { describe, expect, it } from 'vitest';

import {
  edgeSource,
  emptyModel,
  flowEditor,
  nodeSource,
  parse,
  serialize,
  uniqueId,
} from './model.ts';
import { FLOW_FIXTURES } from '../../tests/fixtures/flow.ts';
import { loadMermaid } from '../../tests/mermaid-loader.ts';

import type { FlowGraph } from './model.ts';
import type { DiagramLoader, MermaidDiagram } from '@nautink/visual-core/editor-contract';

/** Subgraph member order is not meaningful: Mermaid reads members back in source order. */
function normalized(graph: FlowGraph): FlowGraph {
  return {
    ...graph,
    subgraphs: graph.subgraphs.map((subgraph) => ({
      ...subgraph,
      members: [...subgraph.members].sort(),
    })),
  };
}

async function parseOk(code: string): Promise<FlowGraph> {
  const result = await parse(code, loadMermaid);
  if (result.kind !== 'ok') {
    throw new Error(`${result.kind}: ${result.message}`);
  }
  return result.model;
}

describe('flowchart round trip', () => {
  it.each(Object.entries(FLOW_FIXTURES))(
    '%s is stable and keeps its meaning',
    async (name, code) => {
      const first = await parseOk(code);
      const written = serialize(first);
      const second = await parseOk(written);
      expect(name).toBeTruthy();
      expect(normalized(second)).toEqual(normalized(first));
      expect(serialize(second)).toBe(written);
    },
  );
});

describe('parse', () => {
  it('reads the template', async () => {
    const graph = await parseOk(FLOW_FIXTURES.template!);
    expect(graph.direction).toBe('TD');
    expect(graph.nodes.map((node) => [node.id, node.shape, node.label])).toEqual([
      ['start', 'stadium', 'Start'],
      ['input', 'lean-r', 'Read request'],
      ['valid', 'diam', 'Valid?'],
      ['save', 'cyl', 'Save to DB'],
      ['error', 'rect', 'Show error'],
      ['done', 'stadium', 'Done'],
    ]);
    expect(graph.edges[2]).toEqual({
      id: 'L_valid_save_0',
      source: 'valid',
      target: 'save',
      label: 'yes',
      arrow: 'point',
      stroke: 'normal',
    });
  });

  it('numbers parallel edges', async () => {
    const graph = await parseOk(FLOW_FIXTURES.parallelEdges!);
    expect(graph.edges.map((edge) => edge.id)).toEqual(['L_a_b_0', 'L_a_b_1']);
  });

  it('keeps style lines, drops comments and represents classes', async () => {
    const graph = await parseOk(FLOW_FIXTURES.styling!);
    expect(graph.extra).toEqual([
      'classDef hot fill:#f00',
      'classDef cool stroke:#00f',
      'style a stroke-width:4px',
      'linkStyle 0 stroke:red',
      'click a href "https://example.com"',
      'accTitle: Title',
      'accDescr: Description',
    ]);
    expect(graph.nodes.map((node) => [node.id, node.classes])).toEqual([
      ['a', ['hot']],
      ['b', ['cool']],
      ['c', ['cool']],
    ]);
  });

  it('reads icon and image nodes', async () => {
    const graph = await parseOk(FLOW_FIXTURES.icons!);
    expect(graph.nodes[0]).toMatchObject({
      icon: 'mdi:database',
      form: 'square',
      label: 'DB',
      pos: 'b',
      h: 60,
    });
    expect(graph.nodes[1]).toMatchObject({
      img: 'https://example.com/x.png',
      w: 80,
      h: 40,
      constraint: 'on',
    });
    expect(graph.nodes[2]).toMatchObject({ icon: 'logos:aws', label: '', h: null });
  });

  it('reads nested subgraphs with titles and directions', async () => {
    const graph = await parseOk(FLOW_FIXTURES.subgraphs!);
    expect(graph.subgraphs).toEqual([
      { id: 'inner', title: '', members: ['c'], dir: '' },
      { id: 'outer', title: 'Outer group', members: ['b', 'a', 'inner'], dir: 'TB' },
      { id: 'solo', title: '', members: ['d'], dir: '' },
    ]);
  });

  it('writes unknown arrows as a plain arrow', async () => {
    const graph = await parseOk(FLOW_FIXTURES.arrows!);
    expect(serialize(graph)).toContain('    a --> k\n');
  });

  it('returns an empty graph for empty code', async () => {
    expect(await parse('  \n', loadMermaid)).toEqual({ kind: 'ok', model: emptyModel() });
  });

  it('reports other diagram types as unsupported', async () => {
    expect(await parse('sequenceDiagram\n    a->>b: hi\n', loadMermaid)).toEqual({
      kind: 'unsupported',
      message: 'sequence',
    });
  });

  it('reports invalid code as an error', async () => {
    const result = await parse('flowchart TD\n    a -->\n', loadMermaid);
    expect(result.kind).toBe('error');
  });

  it('reports a db without the flowchart methods', async () => {
    const result = await parse('flowchart TD', async () =>
      Promise.resolve({ type: 'flowchart-v2', db: {} }),
    );
    expect(result.kind).toBe('error');
  });

  it('reports an unknown direction', async () => {
    const db = {
      getVertices: (): Map<string, object> => new Map(),
      getEdges: (): object[] => [],
      getSubGraphs: (): object[] => [],
      getDirection: (): string => 'XY',
    };
    const result = await parse('flowchart XY', async () =>
      Promise.resolve({ type: 'flowchart-v2', db }),
    );
    expect(result).toEqual({ kind: 'error', message: 'Unknown flowchart direction "XY"' });
  });
});

describe('parse with a minimal db', () => {
  const load =
    (db: object): DiagramLoader =>
    async (): Promise<MermaidDiagram> =>
      Promise.resolve({ type: 'flowchart-v2', db });

  it('fills in every field Mermaid leaves out', async () => {
    const db = {
      getVertices: (): Map<string, object> =>
        new Map([
          ['a', { id: 'a' }],
          ['b', { id: 'b', text: 'b', img: 'u' }],
          ['c', { id: 'c', icon: 'mdi:x', text: 'C', assetHeight: 0 }],
        ]),
      getEdges: (): object[] => [
        { start: 'a', end: 'b' },
        { start: 'a', end: 'b', type: 'arrow_cross', stroke: 'weird' },
      ],
      getSubGraphs: (): object[] => [{ id: 's', title: 's', nodes: ['a'] }],
    };
    const result = await parse('flowchart', load(db));
    expect(result).toEqual({
      kind: 'ok',
      model: {
        direction: 'TD',
        nodes: [
          { id: 'a', label: 'a', shape: 'rect', classes: [] },
          {
            id: 'b',
            label: '',
            shape: 'rect',
            classes: [],
            img: 'u',
            pos: '',
            w: null,
            h: null,
            constraint: '',
          },
          {
            id: 'c',
            label: 'C',
            shape: 'rect',
            classes: [],
            icon: 'mdi:x',
            form: '',
            pos: '',
            h: null,
          },
        ],
        edges: [
          { id: 'L_a_b_0', source: 'a', target: 'b', label: '', arrow: 'point', stroke: 'normal' },
          { id: 'L_a_b_1', source: 'a', target: 'b', label: '', arrow: 'cross', stroke: 'normal' },
        ],
        subgraphs: [{ id: 's', title: '', members: ['a'], dir: '' }],
        preamble: '',
        extra: [],
      },
    });
  });

  it('reads an empty direction as TD', async () => {
    const db = {
      getVertices: (): Map<string, object> => new Map(),
      getEdges: (): object[] => [],
      getSubGraphs: (): object[] => [],
      getDirection: (): string => '',
    };
    const result = await parse('flowchart', load(db));
    expect(result.kind === 'ok' && result.model.direction).toBe('TD');
  });

  it('turns anything thrown while reading the db into an error', async () => {
    const db = {
      getVertices: (): Map<string, object> => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error -- testing a non-Error throw
        throw 'broken';
      },
      getEdges: (): object[] => [],
      getSubGraphs: (): object[] => [],
    };
    expect(await parse('flowchart', load(db))).toEqual({ kind: 'error', message: 'broken' });
  });
});

describe('serialize', () => {
  it('writes the template in normalized order', async () => {
    expect(serialize(await parseOk(FLOW_FIXTURES.template!))).toBe(`flowchart TD
    start([Start])
    input[/Read request/]
    valid{Valid?}
    save[(Save to DB)]
    error[Show error]
    done([Done])
    start --> input
    input --> valid
    valid -->|yes| save
    valid -->|no| error
    error --> input
    save --> done
`);
  });

  it('writes subgraphs, classes and kept lines', async () => {
    expect(serialize(await parseOk(FLOW_FIXTURES.subgraphs!))).toBe(`flowchart LR
    subgraph outer [Outer group]
        direction TB
        a
        b
        subgraph inner
            c
        end
    end
    subgraph solo
        d
    end
    a --> b
    outer --> d
    c --> d
`);
  });

  it('keeps the preamble', async () => {
    expect(serialize(await parseOk(FLOW_FIXTURES.preamble!))).toBe(
      '---\ntitle: Hello\n---\n%%{init: {"theme": "dark"}}%%\nflowchart TD\n    a\n    b\n    a --> b\n',
    );
  });
});

describe('nodeSource', () => {
  const base = { id: 'a', label: 'A', shape: 'rect', classes: [] };

  it('writes a bare id, classic brackets or @{ shape }', () => {
    expect(nodeSource({ ...base, label: 'a' })).toBe('a');
    expect(nodeSource(base)).toBe('a[A]');
    expect(nodeSource({ ...base, shape: 'diam', label: 'x"y' })).toBe('a{"x#quot;y"}');
    expect(nodeSource({ ...base, shape: 'cloud', label: 'say "hi"' })).toBe(
      'a@{ shape: cloud, label: "say #quot;hi#quot;" }',
    );
  });

  it('writes asset nodes with only the fields that are set', () => {
    expect(nodeSource({ ...base, icon: 'mdi:x', form: '', pos: '', h: null, label: '' })).toBe(
      'a@{ icon: "mdi:x" }',
    );
    expect(nodeSource({ ...base, img: 'u', w: 10, h: 0, constraint: 'on' })).toBe(
      'a@{ img: "u", label: "A", w: 10, constraint: "on" }',
    );
  });
});

describe('edgeSource', () => {
  it('writes every stroke and arrow', () => {
    const edge = {
      id: 'e',
      source: 'a',
      target: 'b',
      label: '',
      arrow: 'point',
      stroke: 'normal',
    } as const;
    expect(edgeSource(edge)).toBe('a --> b');
    expect(edgeSource({ ...edge, stroke: 'dotted', arrow: 'cross' })).toBe('a -.-x b');
    expect(edgeSource({ ...edge, stroke: 'thick', arrow: 'open', label: 'x|y' })).toBe(
      'a ===|"x|y"| b',
    );
  });
});

describe('uniqueId', () => {
  it('skips ids taken by nodes and subgraphs', () => {
    const graph = {
      ...emptyModel(),
      nodes: [{ id: 'n1', label: '', shape: 'rect', classes: [] }],
      subgraphs: [{ id: 'n2', title: '', members: [], dir: '' }],
    };
    expect(uniqueId(graph)).toBe('n3');
    expect(uniqueId(graph, 'group')).toBe('group1');
  });
});

describe('flowEditor', () => {
  it('bundles the model functions', () => {
    expect(flowEditor).toEqual({ id: 'flow', emptyModel, parse, serialize });
  });
});
