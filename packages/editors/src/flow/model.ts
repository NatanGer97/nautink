// Flowchart <-> graph model. Parsing reads Mermaid's own flowchart db; serializing writes
// Mermaid source back in a normalized order: nodes and subgraphs, links, classes, kept lines.
import { splitPreamble } from '@nautink/visual-core/preamble';
import { decodeText, quoteLabel } from '@nautink/visual-core/text';

import { canonicalShape, SHAPE_BY_ID } from './library.ts';
import { hasMethods, parseWithMermaid } from '../shared/mermaid-parse.ts';
import { parentMap } from '../shared/subgraphs.ts';
import { numberOr, numberOrNull } from '../shared/values.ts';

import type {
  DiagramLoader,
  EditorModule,
  ParseResult,
} from '@nautink/visual-core/editor-contract';

export type FlowDirection = 'TD' | 'BT' | 'LR' | 'RL';
export type FlowArrow = 'point' | 'open' | 'circle' | 'cross';
export type FlowStroke = 'normal' | 'dotted' | 'thick';

/** A node. Icon nodes (`icon`) and image nodes (`img`) carry their asset fields too. */
export interface FlowNode {
  id: string;
  label: string;
  shape: string;
  classes: string[];
  icon?: string;
  img?: string;
  form?: string;
  pos?: string;
  w?: number | null;
  h?: number | null;
  constraint?: string;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  arrow: FlowArrow;
  stroke: FlowStroke;
}

/** A subgraph. `members` holds node and subgraph ids; inner subgraphs come first in the list. */
export interface FlowSubgraph {
  id: string;
  title: string;
  members: string[];
  dir: string;
}

export interface FlowGraph {
  direction: FlowDirection;
  nodes: FlowNode[];
  edges: FlowEdge[];
  subgraphs: FlowSubgraph[];
  preamble: string;
  extra: string[];
}

const INDENT: string = '    ';
const DIRECTIONS: readonly FlowDirection[] = ['TD', 'BT', 'LR', 'RL'];
const ARROW_TYPES: readonly FlowArrow[] = ['point', 'open', 'circle', 'cross'];
const STROKES: readonly FlowStroke[] = ['normal', 'dotted', 'thick'];
const ARROWS: Readonly<Record<FlowStroke, Readonly<Record<FlowArrow, string>>>> = {
  normal: { point: '-->', open: '---', circle: '--o', cross: '--x' },
  dotted: { point: '-.->', open: '-.-', circle: '-.-o', cross: '-.-x' },
  thick: { point: '==>', open: '===', circle: '==o', cross: '==x' },
};
// Classes Mermaid adds by itself. v1 kept `clickable`, so every `click` line added one more
// `class x clickable` line per round trip; the class editor already dropped it.
const MERMAID_CLASSES: ReadonlySet<string> = new Set(['default', 'clickable']);
// Lines that the graph model does not represent but must survive a round trip.
const KEEP_RE: RegExp = /^\s*(classDef|style|linkStyle|click|accTitle|accDescr)\b/;

// ---- Mermaid's FlowDB, as far as parsing reads it ----

interface FlowVertex {
  id: string;
  text?: string;
  type?: string;
  classes?: string[];
  icon?: string;
  img?: string;
  form?: string;
  pos?: string;
  assetWidth?: number;
  assetHeight?: number;
  constraint?: string;
}

interface FlowDbEdge {
  start: string;
  end: string;
  text?: string;
  type?: string;
  stroke?: string;
}

interface FlowDbSubgraph {
  id: string;
  title?: string;
  nodes: string[];
  dir?: string;
}

interface FlowDb {
  getVertices: () => Map<string, FlowVertex>;
  getEdges: () => FlowDbEdge[];
  getSubGraphs: () => FlowDbSubgraph[];
  getDirection?: () => string | undefined;
}

function isFlowDb(db: unknown): db is FlowDb {
  return hasMethods(db, ['getVertices', 'getEdges', 'getSubGraphs']);
}

export function emptyModel(): FlowGraph {
  return { direction: 'TD', nodes: [], edges: [], subgraphs: [], preamble: '', extra: [] };
}

function assetFields(vertex: FlowVertex): Partial<FlowNode> {
  const icon: Partial<FlowNode> = vertex.icon
    ? {
        icon: vertex.icon,
        form: vertex.form ?? '',
        pos: vertex.pos ?? '',
        h: numberOrNull(vertex.assetHeight),
      }
    : {};
  const img: Partial<FlowNode> = vertex.img
    ? {
        img: vertex.img,
        pos: vertex.pos ?? '',
        w: numberOrNull(vertex.assetWidth),
        h: numberOrNull(vertex.assetHeight),
        constraint: vertex.constraint ?? '',
      }
    : {};
  return { ...icon, ...img };
}

function nodeFromVertex(vertex: FlowVertex): FlowNode {
  const node: FlowNode = {
    id: vertex.id,
    label: decodeText(vertex.text ?? vertex.id),
    shape: canonicalShape(vertex.type),
    classes: (vertex.classes ?? []).filter((name: string) => !MERMAID_CLASSES.has(name)),
  };
  if (!vertex.icon && !vertex.img) {
    return node;
  }
  const label: string = vertex.text === vertex.id ? '' : decodeText(vertex.text ?? '');
  return { ...node, ...assetFields(vertex), label };
}

function arrowOf(type: string | undefined): FlowArrow | undefined {
  const name: string = (type ?? 'arrow_point').replace('arrow_', '');
  return ARROW_TYPES.find((arrow: FlowArrow) => arrow === name);
}

function strokeOf(stroke: string | undefined): FlowStroke {
  return STROKES.find((known: FlowStroke) => known === stroke) ?? 'normal';
}

// v1 wrote every unknown arrow (such as `<-->`) as a plain `-->`, whatever its stroke.
function edgeFromDb(edge: FlowDbEdge, index: number): FlowEdge {
  const arrow: FlowArrow | undefined = arrowOf(edge.type);
  return {
    id: `L_${edge.start}_${edge.end}_${String(index)}`,
    source: edge.start,
    target: edge.end,
    label: decodeText(edge.text ?? ''),
    arrow: arrow ?? 'point',
    stroke: arrow ? strokeOf(edge.stroke) : 'normal',
  };
}

function edgesFromDb(edges: readonly FlowDbEdge[]): FlowEdge[] {
  const counts: Map<string, number> = new Map<string, number>();
  return edges.map((edge: FlowDbEdge): FlowEdge => {
    const key: string = `${edge.start}_${edge.end}`;
    const index: number = (counts.get(key) ?? -1) + 1;
    counts.set(key, index);
    return edgeFromDb(edge, index);
  });
}

function subgraphFromDb(subgraph: FlowDbSubgraph): FlowSubgraph {
  const hasTitle: boolean = Boolean(subgraph.title) && subgraph.title !== subgraph.id;
  return {
    id: subgraph.id,
    title: hasTitle ? decodeText(subgraph.title ?? '') : '',
    members: [...subgraph.nodes],
    dir: subgraph.dir ?? '',
  };
}

function directionOf(db: FlowDb): FlowDirection {
  const raw: string = db.getDirection?.() ?? 'TD';
  const direction: string = raw === 'TB' || raw === '' ? 'TD' : raw;
  const known: FlowDirection | undefined = DIRECTIONS.find(
    (dir: FlowDirection) => dir === direction,
  );
  if (known === undefined) {
    throw new Error(`Unknown flowchart direction "${raw}"`);
  }
  return known;
}

function graphFromDb(db: FlowDb, code: string): FlowGraph {
  const { preamble, body } = splitPreamble(code);
  return {
    direction: directionOf(db),
    nodes: [...db.getVertices().values()].map(nodeFromVertex),
    edges: edgesFromDb(db.getEdges()),
    subgraphs: db.getSubGraphs().map(subgraphFromDb),
    preamble,
    extra: body
      .split('\n')
      .filter((line: string) => KEEP_RE.test(line))
      .map((line: string) => line.trim()),
  };
}

/** Mermaid flowchart source to a graph. Empty code is an empty graph. */
export async function parse(code: string, load: DiagramLoader): Promise<ParseResult<FlowGraph>> {
  if (!code.trim()) {
    return { kind: 'ok', model: emptyModel() };
  }
  return parseWithMermaid({
    code,
    load,
    type: /^flowchart/,
    isDb: isFlowDb,
    build: (db: FlowDb): FlowGraph => graphFromDb(db, code),
  });
}

// ---- serialize ----

// Mermaid's @{ } strings have no escapes; use its #quot; entity for double quotes.
function jsonString(text: string): string {
  return `"${text.replace(/"/g, '#quot;')}"`;
}

function stringProp(name: string, value: string | undefined): string[] {
  return value ? [`${name}: ${jsonString(value)}`] : [];
}

function numberProp(name: string, value: number | null | undefined): string[] {
  const number: number = numberOr(value, 0);
  return number === 0 ? [] : [`${name}: ${String(number)}`];
}

function assetSource(node: FlowNode): string {
  const props: string[] = [
    ...(node.icon ? stringProp('icon', node.icon) : stringProp('img', node.img)),
    ...stringProp('form', node.form),
    ...stringProp('label', node.label),
    ...stringProp('pos', node.pos),
    ...numberProp('w', node.w),
    ...numberProp('h', node.h),
    ...stringProp('constraint', node.constraint),
  ];
  return `${node.id}@{ ${props.join(', ')} }`;
}

/** One node as Mermaid source: bare id, classic brackets, or `@{ shape }` / asset syntax. */
export function nodeSource(node: FlowNode): string {
  if (node.icon || node.img) {
    return assetSource(node);
  }
  if (node.shape === 'rect' && node.label === node.id) {
    return node.id;
  }
  const classic: readonly [string, string] | undefined = SHAPE_BY_ID.get(node.shape)?.classic;
  if (classic) {
    return `${node.id}${classic[0]}${quoteLabel(node.label)}${classic[1]}`;
  }
  return `${node.id}@{ shape: ${node.shape}, label: ${jsonString(node.label)} }`;
}

/** One link as Mermaid source. */
export function edgeSource(edge: FlowEdge): string {
  const label: string = edge.label ? `|${quoteLabel(edge.label)}|` : '';
  return `${edge.source} ${ARROWS[edge.stroke][edge.arrow]}${label} ${edge.target}`;
}

interface EmitContext {
  graph: FlowGraph;
  parent: Map<string, string>;
  groupIds: ReadonlySet<string>;
}

function subgraphLines(context: EmitContext, subgraph: FlowSubgraph, indent: string): string[] {
  const title: string = subgraph.title ? ` [${quoteLabel(subgraph.title)}]` : '';
  return [
    `${indent}subgraph ${subgraph.id}${title}`,
    ...(subgraph.dir ? [`${indent}${INDENT}direction ${subgraph.dir}`] : []),
    ...scopeLines(context, subgraph.id, indent + INDENT),
    `${indent}end`,
  ];
}

function scopeLines(context: EmitContext, scope: string | undefined, indent: string): string[] {
  const { graph, parent, groupIds } = context;
  const nodes: string[] = graph.nodes
    .filter((node: FlowNode) => parent.get(node.id) === scope && !groupIds.has(node.id))
    .map((node: FlowNode) => indent + nodeSource(node));
  const groups: string[] = graph.subgraphs
    .filter((subgraph: FlowSubgraph) => parent.get(subgraph.id) === scope)
    .flatMap((subgraph: FlowSubgraph) => subgraphLines(context, subgraph, indent));
  return [...nodes, ...groups];
}

function classLines(nodes: readonly FlowNode[]): string[] {
  const byClass: Record<string, string[]> = {};
  for (const node of nodes) {
    for (const name of node.classes) {
      byClass[name] = [...(byClass[name] ?? []), node.id];
    }
  }
  return Object.entries(byClass).map(
    ([name, ids]: [string, string[]]) => `${INDENT}class ${ids.join(',')} ${name}`,
  );
}

/** The graph as Mermaid source. */
export function serialize(graph: FlowGraph): string {
  const context: EmitContext = {
    graph,
    parent: parentMap(graph.subgraphs),
    groupIds: new Set(graph.subgraphs.map((subgraph: FlowSubgraph) => subgraph.id)),
  };
  const lines: string[] = [
    ...(graph.preamble ? [graph.preamble.trimEnd()] : []),
    `flowchart ${graph.direction}`,
    ...scopeLines(context, undefined, INDENT),
    ...graph.edges.map((edge: FlowEdge) => INDENT + edgeSource(edge)),
    ...classLines(graph.nodes),
    ...graph.extra.map((line: string) => INDENT + line),
  ];
  return `${lines.join('\n')}\n`;
}

/** The first free id `<prefix><n>` among nodes and subgraphs. */
export function uniqueId(graph: FlowGraph, prefix: string = 'n'): string {
  const taken: Set<string> = new Set<string>([
    ...graph.nodes.map((node: FlowNode) => node.id),
    ...graph.subgraphs.map((subgraph: FlowSubgraph) => subgraph.id),
  ]);
  let index: number = 1;
  while (taken.has(`${prefix}${String(index)}`)) {
    index++;
  }
  return `${prefix}${String(index)}`;
}

export const flowEditor: EditorModule<FlowGraph> = { id: 'flow', emptyModel, parse, serialize };
