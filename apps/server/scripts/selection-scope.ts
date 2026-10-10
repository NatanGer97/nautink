// The PRD §4.1 check: did a reply about selected flowchart nodes change only those nodes and their
// direct links? Compares two parsed graphs; pure, so it is unit-tested without Claude.
import type { FlowEdge, FlowGraph, FlowNode, FlowSubgraph } from '@nautink/editors/flow/model';

/**
 * What a reply about `selected` may touch:
 * - the selected nodes (change, restyle, delete);
 * - links with a selected node, or a new node, at one end;
 * - new nodes whose every link goes to a selected node, a neighbour of one, or another new node;
 * - groups made of, or only gaining and losing, those nodes; `classDef` lines.
 * Everything else must parse to the same graph.
 */
export interface ScopeInput {
  before: FlowGraph;
  after: FlowGraph;
  selected: readonly string[];
}

function nodeKey(node: FlowNode): string {
  return JSON.stringify([node.label, node.shape, [...node.classes].sort(), node.icon, node.img]);
}

function edgeKey(edge: FlowEdge): string {
  return JSON.stringify([edge.source, edge.target, edge.label, edge.arrow, edge.stroke]);
}

function byId<T extends { id: string }>(items: readonly T[]): Map<string, T> {
  return new Map<string, T>(items.map((item) => [item.id, item]));
}

/** Items of `a` that are not in `b`, counting repeats (a multiset difference). */
function missingFrom(a: readonly string[], b: readonly string[]): string[] {
  const left: string[] = [...b];
  return a.filter((item) => {
    const index: number = left.indexOf(item);
    if (index === -1) {
      return true;
    }
    left.splice(index, 1);
    return false;
  });
}

function neighbours(edges: readonly FlowEdge[], ids: ReadonlySet<string>): Set<string> {
  const found: Set<string> = new Set<string>();
  for (const edge of edges) {
    if (ids.has(edge.source)) {
      found.add(edge.target);
    }
    if (ids.has(edge.target)) {
      found.add(edge.source);
    }
  }
  return found;
}

/** New nodes that hang off the selection: every link of theirs stays near it. */
function attachedNewNodes(input: ScopeInput, selected: ReadonlySet<string>): Set<string> {
  const known: Set<string> = new Set<string>(input.before.nodes.map((node) => node.id));
  const added: Set<string> = new Set<string>(
    input.after.nodes.map((node) => node.id).filter((id) => !known.has(id)),
  );
  const near: Set<string> = new Set<string>([
    ...selected,
    ...neighbours(input.before.edges, selected),
    ...added,
  ]);
  return new Set<string>(
    [...added].filter((id) => {
      const links: FlowEdge[] = input.after.edges.filter((e) => e.source === id || e.target === id);
      return links.length > 0 && links.every((e) => near.has(e.source) && near.has(e.target));
    }),
  );
}

function nodeViolations(input: ScopeInput, allowed: ReadonlySet<string>): string[] {
  const before: Map<string, FlowNode> = byId(input.before.nodes);
  const after: Map<string, FlowNode> = byId(input.after.nodes);
  const ids: Set<string> = new Set<string>([...before.keys(), ...after.keys()]);
  return [...ids].flatMap((id) => {
    const old: FlowNode | undefined = before.get(id);
    const next: FlowNode | undefined = after.get(id);
    const isSame: boolean =
      old !== undefined && next !== undefined && nodeKey(old) === nodeKey(next);
    if (isSame || allowed.has(id)) {
      return [];
    }
    if (next === undefined) {
      return [`removed node ${id}`];
    }
    return old === undefined ? [`added unrelated node ${id}`] : [`changed node ${id}`];
  });
}

function edgeViolations(input: ScopeInput, allowed: ReadonlySet<string>): string[] {
  const before: string[] = input.before.edges.map(edgeKey);
  const after: string[] = input.after.edges.map(edgeKey);
  const changed: { key: string; verb: string }[] = [
    ...missingFrom(before, after).map((key) => ({ key, verb: 'removed' })),
    ...missingFrom(after, before).map((key) => ({ key, verb: 'added' })),
  ];
  return changed.flatMap(({ key, verb }) => {
    const [source, target] = JSON.parse(key) as [string, string];
    return allowed.has(source) || allowed.has(target) ? [] : [`${verb} link ${source} → ${target}`];
  });
}

interface GroupPair {
  old: FlowSubgraph | undefined;
  next: FlowSubgraph | undefined;
}

/** Members that joined or left the group (all of them for a new or removed group). */
function movedMembers({ old, next }: GroupPair): string[] {
  const was: string[] = old?.members ?? [];
  const is: string[] = next?.members ?? [];
  return [...missingFrom(was, is), ...missingFrom(is, was)];
}

/** The title and direction stayed, or the group is new: only its members may differ. */
function isFrameKept({ old, next }: GroupPair): boolean {
  if (old === undefined) {
    return true;
  }
  return next?.title === old.title && next.dir === old.dir;
}

function groupViolation(id: string, pair: GroupPair, allowed: ReadonlySet<string>): string | null {
  const moved: string[] = movedMembers(pair);
  const isInScope: boolean =
    allowed.has(id) || (isFrameKept(pair) && moved.every((member) => allowed.has(member)));
  return isInScope ? null : `changed group ${id}`;
}

function groupViolations(input: ScopeInput, allowed: ReadonlySet<string>): string[] {
  const before: Map<string, FlowSubgraph> = byId(input.before.subgraphs);
  const after: Map<string, FlowSubgraph> = byId(input.after.subgraphs);
  const ids: Set<string> = new Set<string>([...before.keys(), ...after.keys()]);
  return [...ids].flatMap((id) => {
    const violation: string | null = groupViolation(
      id,
      { old: before.get(id), next: after.get(id) },
      allowed,
    );
    return violation === null ? [] : [violation];
  });
}

/** `style B …`, `class B red`, `click B …`: lines about a node name it as a word. */
function mentionsAllowed(line: string, allowed: ReadonlySet<string>): boolean {
  const words: string[] = line.split(/[\s,;:]+/);
  return words.some((word) => allowed.has(word));
}

function extraViolations(input: ScopeInput, allowed: ReadonlySet<string>): string[] {
  const changed: string[] = [
    ...missingFrom(input.before.extra, input.after.extra),
    ...missingFrom(input.after.extra, input.before.extra),
  ];
  return changed
    .filter((line) => !/^\s*classDef\b/.test(line) && !mentionsAllowed(line, allowed))
    .map((line) => `changed line "${line.trim()}"`);
}

function frameViolations(input: ScopeInput): string[] {
  const { before, after } = input;
  return [
    ...(before.direction === after.direction ? [] : ['changed the direction']),
    ...(before.preamble === after.preamble ? [] : ['changed the front matter']),
  ];
}

/** Every change outside the selection's reach, in words; empty when the reply stayed in scope. */
export function scopeViolations(input: ScopeInput): string[] {
  const selected: Set<string> = new Set<string>(input.selected);
  const allowed: Set<string> = new Set<string>([...selected, ...attachedNewNodes(input, selected)]);
  return [
    ...frameViolations(input),
    ...nodeViolations(input, allowed),
    ...edgeViolations(input, allowed),
    ...groupViolations(input, allowed),
    ...extraViolations(input, allowed),
  ];
}
