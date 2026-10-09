// Map a click on the rendered SVG to the line of Mermaid source that defines it (v1's `locate.js`).

/** What was clicked: the diagram ids found on the element or its ancestors, and its short text. */
export interface ShapeHit {
  ids: string[];
  text: string;
}

/** Mermaid's element ids for flowchart nodes, classes, entities and states: `<prefix>-<kind>-<id>-<n>`. */
const NODE_PATTERNS: readonly RegExp[] = [
  /-flowchart-(.+)-\d+$/,
  /-classId-(.+)-\d+$/,
  /-entity-(.+)-\d+$/,
  /-state-(.+)-\d+$/,
];
const GENERATED_DATA_ID: RegExp = /^i\d+$|^edge\d+$/;
const STATE_ROOT: RegExp = /^root_(start|end)$/;
const STATE_END_SUFFIX: RegExp = /_(start|end)$/;
const EDGE_ID: RegExp = /^L_(.+)_(\d+)$/;
const DECLARES: RegExp = /[[({>]|\bclass\b|\bstate\b|\bparticipant\b|\bactor\b|\{\s*$/;
/** Text longer than this is a container (a cluster, the whole diagram), not one shape. */
const MAX_TEXT_LENGTH: number = 80;

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Matches `id` as a whole word (hyphens count as part of a word, as in Mermaid ids). */
function wordPattern(id: string): RegExp {
  return new RegExp(`(^|[^\\w-])${escapeRegExp(id)}($|[^\\w-])`);
}

/** The diagram ids one element carries: its `name`, a meaningful `data-id`, or a node id. */
export function idsOf(element: Element): string[] {
  const ids: string[] = [];
  const name: string | null = element.getAttribute('name');
  if (name !== null && name !== '') {
    ids.push(name);
  }
  const dataId: string | null = element.getAttribute('data-id');
  if (dataId !== null && dataId !== '' && !GENERATED_DATA_ID.test(dataId)) {
    ids.push(dataId);
  }
  for (const pattern of NODE_PATTERNS) {
    const match: string | undefined = pattern.exec(element.id)?.[1];
    if (match !== undefined && !STATE_ROOT.test(match)) {
      ids.push(match.replace(STATE_END_SUFFIX, ''));
    }
  }
  return ids;
}

/** Walks up from the clicked element to `root`, collecting the first ids and short text found. */
export function hitFromElement(target: Element, root: Element): ShapeHit {
  let text: string = '';
  for (
    let element: Element | null = target;
    element !== null && element !== root;
    element = element.parentElement
  ) {
    const content: string = element.textContent.trim();
    if (text === '' && content !== '' && content.length < MAX_TEXT_LENGTH) {
      text = content;
    }
    const ids: string[] = idsOf(element);
    if (ids.length > 0) {
      return { ids, text };
    }
  }
  return { ids: [], text };
}

/** The 1-based number of the first line after the diagram keyword that passes `test`. */
function firstLine(lines: readonly string[], test: (line: string) => boolean): number | null {
  const index: number = lines.findIndex((line, position) => position > 0 && test(line));
  return index === -1 ? null : index + 1;
}

/** An edge id like `L_a_b_0`: the first line that mentions both ends (ids may contain `_`). */
function edgeLine(lines: readonly string[], ends: string): number | null {
  const parts: string[] = ends.split('_');
  for (let split: number = 1; split < parts.length; split++) {
    const from: RegExp = wordPattern(parts.slice(0, split).join('_'));
    const to: RegExp = wordPattern(parts.slice(split).join('_'));
    const line: number | null = firstLine(lines, (text) => from.test(text) && to.test(text));
    if (line !== null) {
      return line;
    }
  }
  return null;
}

/** A line that declares the id (shape, block or alias), else any line that mentions it. */
function idLine(lines: readonly string[], id: string): number | null {
  const pattern: RegExp = wordPattern(id);
  return (
    firstLine(lines, (text) => pattern.test(text) && DECLARES.test(text)) ??
    firstLine(lines, (text) => pattern.test(text))
  );
}

/** The 1-based source line for a click, or null when nothing in the code matches. */
export function locateLine(code: string, hit: ShapeHit): number | null {
  const lines: string[] = code.split('\n');
  for (const id of hit.ids) {
    const edgeEnds: string | undefined = EDGE_ID.exec(id)?.[1];
    const line: number | null =
      edgeEnds === undefined ? idLine(lines, id) : edgeLine(lines, edgeEnds);
    if (line !== null) {
      return line;
    }
  }
  const label: string = hit.text.split('\n')[0]?.trim() ?? '';
  return label.length > 1 ? firstLine(lines, (text) => text.includes(label)) : null;
}
