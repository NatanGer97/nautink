// The diagram-type-neutral half of a change review (PRD §4.2): every editor model is read as a
// flat list of elements, and two lists are paired by key to find what was added, changed or
// removed.

/** How an element differs in Claude's proposal. */
export type ReviewMark = 'added' | 'changed' | 'removed';

/** What an element is on the canvas, so a renderer knows where to look for it. */
export type ReviewKind = 'node' | 'edge' | 'group' | 'note' | 'participant' | 'message';

/** One reviewable part of a diagram. */
export interface ReviewElement {
  /** The editor model's id: the React Flow id, and what Mermaid's render is matched against. */
  id: string;
  kind: ReviewKind;
  /** What makes two elements "the same one" across the two versions (`edge:A>B`). */
  key: string;
  /** Everything that, when it differs, makes the element changed. */
  sig: string;
  label: string;
  /** An edge's or message's two ends. */
  ends?: readonly [string, string];
}

/** A marked element of the diagram shown during review. */
export interface ReviewTarget extends ReviewElement {
  mark: ReviewMark;
  /** Its position among the shown diagram's elements of the same kind. */
  order: number;
}

export interface ReviewCounts {
  added: number;
  changed: number;
  removed: number;
}

type Pair<L extends ReviewElement, R extends ReviewElement> = readonly [L | null, R | null];

function sortedKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortedKeys);
  }
  if (value === null || typeof value !== 'object') {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([key, field]: [string, unknown]) => [key, sortedKeys(field)]),
  );
}

/** A JSON text with object keys sorted, so two equal values always give the same text. */
export function signature(value: unknown): string {
  return JSON.stringify(sortedKeys(value));
}

function groupByKey<T extends ReviewElement>(elements: readonly T[]): Map<string, T[]> {
  const groups: Map<string, T[]> = new Map<string, T[]>();
  for (const element of elements) {
    groups.set(element.key, [...(groups.get(element.key) ?? []), element]);
  }
  return groups;
}

/** Pairs one key's elements: equal ones first, then the rest in order; leftovers stay alone. */
function pairGroup<L extends ReviewElement, R extends ReviewElement>(
  left: readonly L[],
  right: readonly R[],
): Pair<L, R>[] {
  const rest: R[] = [...right];
  const pairs: Pair<L, R>[] = [];
  const unpaired: L[] = left.filter((element: L) => {
    const twin: R | undefined = rest.find((other: R) => other.sig === element.sig);
    if (twin !== undefined) {
      pairs.push([element, twin]);
      rest.splice(rest.indexOf(twin), 1);
    }
    return twin === undefined;
  });
  return [
    ...pairs,
    ...unpaired.map((element: L, index: number): Pair<L, R> => [element, rest.at(index) ?? null]),
    ...rest.slice(unpaired.length).map((element: R): Pair<L, R> => [null, element]),
  ];
}

/** Every element of `left` and `right`, paired by key. */
export function pairElements<L extends ReviewElement, R extends ReviewElement>(
  left: readonly L[],
  right: readonly R[],
): Pair<L, R>[] {
  const rightGroups: Map<string, R[]> = groupByKey(right);
  const leftGroups: Map<string, L[]> = groupByKey(left);
  const keys: string[] = [...new Set<string>([...leftGroups.keys(), ...rightGroups.keys()])];
  return keys.flatMap((key: string) =>
    pairGroup(leftGroups.get(key) ?? [], rightGroups.get(key) ?? []),
  );
}

function markOf([before, after]: Pair<ReviewElement, ReviewElement>): ReviewMark | null {
  if (before === null) {
    return 'added';
  }
  if (after === null) {
    return 'removed';
  }
  return before.sig === after.sig ? null : 'changed';
}

/** How many elements the proposal adds, changes and removes. */
export function countChanges(
  before: readonly ReviewElement[],
  after: readonly ReviewElement[],
): ReviewCounts {
  const counts: ReviewCounts = { added: 0, changed: 0, removed: 0 };
  for (const pair of pairElements(before, after)) {
    const mark: ReviewMark | null = markOf(pair);
    if (mark !== null) {
      counts[mark] += 1;
    }
  }
  return counts;
}

/** `kind:id` of every element of `before` that the proposal removes. */
export function removedRefs(
  before: readonly ReviewElement[],
  after: readonly ReviewElement[],
): Set<string> {
  return new Set<string>(
    pairElements(before, after).flatMap(([element, next]) =>
      element !== null && next === null ? [`${element.kind}:${element.id}`] : [],
    ),
  );
}

type Placed = ReviewElement & { order: number; index: number };

/** Each element with its index, and its position among the elements of its kind. */
function placed(elements: readonly ReviewElement[]): Placed[] {
  const seen: Map<ReviewKind, number> = new Map<ReviewKind, number>();
  return elements.map((element: ReviewElement, index: number): Placed => {
    const order: number = seen.get(element.kind) ?? 0;
    seen.set(element.kind, order + 1);
    return { ...element, order, index };
  });
}

/**
 * The marked elements of `shown` (the proposal, plus the removed elements drawn as ghosts): what
 * matches the proposal takes its mark against `before`; what only `shown` has was removed.
 */
export function reviewTargets(
  shown: readonly ReviewElement[],
  versions: { before: readonly ReviewElement[]; after: readonly ReviewElement[] },
): ReviewTarget[] {
  const proposal: Placed[] = placed(versions.after);
  const marks: Map<number, ReviewMark> = new Map<number, ReviewMark>();
  for (const pair of pairElements(versions.before, proposal)) {
    const mark: ReviewMark | null = markOf(pair);
    if (mark !== null && pair[1] !== null) {
      marks.set(pair[1].index, mark);
    }
  }
  return pairElements(placed(shown), proposal).flatMap(([element, next]): ReviewTarget[] => {
    const mark: ReviewMark | undefined = next === null ? 'removed' : marks.get(next.index);
    return element === null || mark === undefined ? [] : [{ ...element, mark }];
  });
}
