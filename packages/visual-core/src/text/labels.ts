import { clip } from './text.ts';

const NAME_CLIP: number = 28;
const DELETE_CLIP: number = 32;
const RENAME_KEYS: ReadonlySet<string> = new Set(['label', 'name', 'alias', 'title']);
const LINK_KINDS: RegExp = /link|relation|transition|relationship|message/;
const PHRASES: Readonly<Record<string, string>> = {
  shape: 'Changed shape of',
  stroke: 'Changed line style of',
  line: 'Changed line style of',
  arrow: 'Changed arrow of',
  head: 'Changed arrow of',
  fromCard: 'Changed cardinality of',
  toCard: 'Changed cardinality of',
  isIdentifying: 'Changed line of',
  type: 'Changed type of',
  dir: 'Changed direction of',
  fill: 'Changed color of',
  text: 'Edited text of',
  kind: 'Changed kind of',
  m1: 'Changed multiplicity of',
  m2: 'Changed multiplicity of',
  t1: 'Changed end of',
  t2: 'Changed end of',
  vis: 'Changed visibility of',
  side: 'Moved',
  placement: 'Moved',
};

/** The fields an edit changed, as passed to an `update*` op. */
export type LabelPatch = Readonly<Record<string, unknown>>;

interface SingleKeyEdit {
  kind: string;
  name: string;
  key: string;
  value: unknown;
}

function renameLabel({ kind, name, value }: SingleKeyEdit): string {
  if (LINK_KINDS.test(kind)) {
    return `Labelled ${kind}${name ? ` ${name}` : ''}`;
  }
  const what: string = name || kind;
  if (typeof value === 'string' && value.trim()) {
    return `Renamed ${what} → ${clip(value, NAME_CLIP)}`;
  }
  return `Cleared name of ${what}`;
}

function singleKeyLabel(edit: SingleKeyEdit, fallback: string): string {
  if (RENAME_KEYS.has(edit.key)) {
    return renameLabel(edit);
  }
  const phrase: string | undefined = PHRASES[edit.key];
  return phrase === undefined ? fallback : `${phrase} ${edit.name || edit.kind}`;
}

/** Step label for a patch edit: `editLabel('node', 'Start', { label: 'Begin' })` → "Renamed Start → Begin". */
export function editLabel(kind: string, name: string, patch: LabelPatch = {}): string {
  const keys: string[] = Object.keys(patch);
  const clipped: string = clip(name, NAME_CLIP);
  const fallback: string = `Edited ${kind}${clipped ? ` ${clipped}` : ''}`;
  const [key] = keys;
  if (keys.length !== 1 || key === undefined) {
    return fallback;
  }
  return singleKeyLabel({ kind, name: clipped, key, value: patch[key] }, fallback);
}

/** "Deleted Start" for one item, "Deleted 3 items" for more. */
export function deleteLabel(names: readonly string[]): string {
  const list: string[] = names.filter((name: string) => name !== '');
  const [first] = list;
  if (first === undefined) {
    return 'Deleted items';
  }
  return list.length === 1
    ? `Deleted ${clip(first, DELETE_CLIP)}`
    : `Deleted ${String(list.length)} items`;
}
