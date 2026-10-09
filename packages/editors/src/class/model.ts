// classDiagram <-> class model. Parsing reads Mermaid's own ClassDB; serializing writes Mermaid
// source back: classes, namespaces, relations, notes, extra css classes, kept lines.
import { splitPreamble } from '@nautink/visual-core/preamble';
import { decodeText } from '@nautink/visual-core/text';

import { attrSource, idSource, methodSource, nsLeaf, nsParent, quoteSafe } from './text.ts';
import { hasMethods, parseWithMermaid } from '../shared/mermaid-parse.ts';
import { textAt } from '../shared/values.ts';

import type {
  ClassAttr,
  ClassDirection,
  ClassHeader,
  ClassItem,
  ClassLine,
  ClassMark,
  ClassMethod,
  ClassModel,
  ClassNamespace,
  ClassNote,
  ClassRelation,
} from './types.ts';
import type {
  DiagramLoader,
  EditorModule,
  ParseResult,
} from '@nautink/visual-core/editor-contract';

const INDENT: string = '    ';

/** A relation kind offered in the toolbar. `side`: the end that gets the marker for a new link. */
export interface RelationKind {
  id: string;
  name: string;
  line: ClassLine;
  mark: ClassMark;
  side: number;
  op: string;
}

/** The kind a new relation gets when none is chosen. */
export const ASSOCIATION: RelationKind = {
  id: 'association',
  name: 'Association',
  line: 'solid',
  mark: 'dep',
  side: 2,
  op: '-->',
};

// Diamonds sit on the whole (the source); arrows and triangles on the target.
export const KINDS: readonly RelationKind[] = [
  { id: 'inheritance', name: 'Inheritance', line: 'solid', mark: 'ext', side: 2, op: '<|--' },
  { id: 'composition', name: 'Composition', line: 'solid', mark: 'comp', side: 1, op: '*--' },
  { id: 'aggregation', name: 'Aggregation', line: 'solid', mark: 'agg', side: 1, op: 'o--' },
  ASSOCIATION,
  { id: 'link', name: 'Link', line: 'solid', mark: 'none', side: 2, op: '--' },
  { id: 'dependency', name: 'Dependency', line: 'dashed', mark: 'dep', side: 2, op: '..>' },
  { id: 'realization', name: 'Realization', line: 'dashed', mark: 'ext', side: 2, op: '..|>' },
  { id: 'dashed', name: 'Dashed link', line: 'dashed', mark: 'none', side: 2, op: '..' },
];

export const MARKS: readonly (readonly [ClassMark, string])[] = [
  ['none', 'None'],
  ['ext', '◁ Triangle'],
  ['comp', '◆ Diamond'],
  ['agg', '◇ Diamond'],
  ['dep', '< Arrow'],
];

export const STEREOTYPES: readonly string[] = ['interface', 'abstract', 'enumeration', 'service'];

const DIRECTIONS: readonly ClassDirection[] = ['TB', 'BT', 'LR', 'RL'];
// Mermaid relation codes (ClassDB.relationType) -> marker names.
const MARK_BY_CODE: ReadonlyMap<string, ClassMark> = new Map<string, ClassMark>([
  ['0', 'agg'],
  ['1', 'ext'],
  ['2', 'comp'],
  ['3', 'dep'],
  ['4', 'lolli'],
]);
const LEFT: Readonly<Record<ClassMark, string>> = {
  none: '',
  agg: 'o',
  ext: '<|',
  comp: '*',
  dep: '<',
  lolli: '()',
};
const RIGHT: Readonly<Record<ClassMark, string>> = {
  none: '',
  agg: 'o',
  ext: '|>',
  comp: '*',
  dep: '>',
  lolli: '()',
};
const DASHED_LINE_TYPE: number = 1;
const HEADER_AND_DIRECTION: number = 2;
// Lines the model does not represent but must survive a round trip.
const KEEP_RE: RegExp = /^\s*(classDef|style|cssClass|click|link|callback|accTitle|accDescr)\b/;
const NAMED_AMP: ReadonlyMap<string, string> = new Map(
  Object.entries({ colon: ':', semi: ';', apos: "'", amp: '&' }),
);

export function emptyModel(): ClassModel {
  return {
    header: 'classDiagram',
    direction: 'TB',
    isDirExplicit: false,
    classes: [],
    namespaces: [],
    relations: [],
    notes: [],
    preamble: '',
    extra: [],
  };
}

/** The next free relation id `R:<from>:<to>:<n>`. */
export function relationId(relations: readonly ClassRelation[], from: string, to: string): string {
  let index: number = 0;
  while (
    relations.some((relation: ClassRelation) => relation.id === `R:${from}:${to}:${String(index)}`)
  ) {
    index++;
  }
  return `R:${from}:${to}:${String(index)}`;
}

/** The next free note id `note:<class or ->:<n>`. */
export function noteIdFor(notes: readonly ClassNote[], forId: string): string {
  const owner: string = forId || '-';
  let index: number = 0;
  while (notes.some((note: ClassNote) => note.id === `note:${owner}:${String(index)}`)) {
    index++;
  }
  return `note:${owner}:${String(index)}`;
}

// ---- Mermaid's ClassDB, as far as parsing reads it ----

interface DbMember {
  id?: string;
  visibility?: string;
  classifier?: string;
  parameters?: string;
  returnType?: string;
}

interface DbClass {
  id: string;
  label?: string;
  type?: string;
  annotations?: string[];
  members?: DbMember[];
  methods?: DbMember[];
  cssClasses?: string;
  parent?: string;
}

interface DbRelation {
  id1: string;
  id2: string;
  relation: { type1: number | string; type2: number | string; lineType: number };
  title?: string;
  relationTitle1?: string;
  relationTitle2?: string;
}

interface DbNote {
  text: string;
  class?: string;
  parent?: string;
}

interface ClassDb {
  getClasses: () => Map<string, DbClass>;
  getNamespaces: () => Map<string, { id: string; label?: string }>;
  getRelations: () => DbRelation[];
  getNotes: () => Map<string, DbNote> | DbNote[];
  getDirection?: () => string | undefined;
  interfaces?: { id: string; label: string }[];
}

function isClassDb(db: unknown): db is ClassDb {
  return hasMethods(db, ['getClasses', 'getNamespaces', 'getRelations', 'getNotes']);
}

// Mermaid stores entities in a placeholder form while parsing; decode db text to plain text.
function decodeEntities(text: string | undefined): string {
  return decodeText(text ?? '').replace(
    /&(colon|semi|apos|amp);/g,
    (entity: string) => NAMED_AMP.get(entity.slice(1, -1)) ?? entity,
  );
}

function directionOf(value: string | undefined): ClassDirection {
  const direction: ClassDirection | undefined = DIRECTIONS.find(
    (known: ClassDirection) => known === value,
  );
  if (value && direction === undefined) {
    throw new Error(`Unknown class diagram direction "${value}"`);
  }
  return direction ?? 'TB';
}

// ---- parse: kept lines ----

function blockEnd(lines: readonly string[], start: number): number {
  const end: number = lines.findIndex(
    (line: string, index: number) => index > start && line.includes('}'),
  );
  return end === -1 ? lines.length - 1 : end;
}

function isOpenAccDescr(line: string): boolean {
  return /^\s*accDescr\s*\{/.test(line) && !line.includes('}');
}

// Preserved lines, multi-line `accDescr { ... }` blocks included.
function keptLines(lines: readonly string[]): string[] {
  const extra: string[] = [];
  for (let index: number = 0; index < lines.length; index++) {
    const line: string = textAt(lines, index);
    if (!KEEP_RE.test(line)) {
      continue;
    }
    const end: number = isOpenAccDescr(line) ? blockEnd(lines, index) : index;
    extra.push(
      lines
        .slice(index, end + 1)
        .map((part: string) => part.trim())
        .join('\n'),
    );
    index = end;
  }
  return extra;
}

// css classes set by kept `cssClass` lines are not repeated on the class itself.
function keptCssClasses(extra: readonly string[]): Map<string, Set<string>> {
  const kept: Map<string, Set<string>> = new Map<string, Set<string>>();
  for (const line of extra) {
    const match: RegExpExecArray | null = /^cssClass\s+"([^"]+)"\s+(\S+)/.exec(line);
    for (const id of match?.[1]?.split(',') ?? []) {
      const set: Set<string> = kept.get(id.trim()) ?? new Set<string>();
      set.add(match?.[2] ?? '');
      kept.set(id.trim(), set);
    }
  }
  return kept;
}

// ---- parse: classes, namespaces, relations, notes ----

function attrFromDb(member: DbMember): ClassAttr {
  return {
    vis: member.visibility ?? '',
    text: decodeEntities(member.id),
    cls: member.classifier ?? '',
  };
}

function methodFromDb(member: DbMember): ClassMethod {
  return {
    vis: member.visibility ?? '',
    name: decodeEntities(member.id),
    params: decodeEntities(member.parameters),
    ret: decodeEntities(member.returnType),
    cls: member.classifier ?? '',
  };
}

function cssOf(item: DbClass, kept: ReadonlyMap<string, ReadonlySet<string>>): string[] {
  const ignored: ReadonlySet<string> = kept.get(item.id) ?? new Set<string>();
  return (item.cssClasses ?? '')
    .split(/\s+/)
    .filter(
      (name: string) => name && name !== 'default' && name !== 'clickable' && !ignored.has(name),
    );
}

function classFromDb(item: DbClass, kept: ReadonlyMap<string, ReadonlySet<string>>): ClassItem {
  const hasLabel: boolean = Boolean(item.label) && item.label !== item.id;
  return {
    id: item.id,
    label: hasLabel ? decodeEntities(item.label) : '',
    generic: decodeEntities(item.type),
    annotations: (item.annotations ?? []).map(decodeEntities),
    attrs: (item.members ?? []).map(attrFromDb),
    methods: (item.methods ?? []).map(methodFromDb),
    css: cssOf(item, kept),
    ns: item.parent ?? '',
  };
}

function namespaceFromDb(namespace: { id: string; label?: string }): ClassNamespace {
  const hasLabel: boolean = Boolean(namespace.label) && namespace.label !== nsLeaf(namespace.id);
  return { id: namespace.id, label: hasLabel ? decodeEntities(namespace.label) : '' };
}

function markOf(code: number | string): ClassMark {
  return MARK_BY_CODE.get(String(code)) ?? 'none';
}

function multiplicity(title: string | undefined): string {
  return title && title !== 'none' ? decodeEntities(title) : '';
}

function relationText(relation: DbRelation): Pick<ClassRelation, 'line' | 'label' | 'm1' | 'm2'> {
  return {
    line: relation.relation.lineType === DASHED_LINE_TYPE ? 'dashed' : 'solid',
    label: decodeEntities(relation.title),
    m1: multiplicity(relation.relationTitle1),
    m2: multiplicity(relation.relationTitle2),
  };
}

function relationFromDb(
  relation: DbRelation,
  interfaces: ReadonlyMap<string, string>,
  taken: readonly ClassRelation[],
): ClassRelation {
  const t1: ClassMark = markOf(relation.relation.type1);
  const t2: ClassMark = markOf(relation.relation.type2);
  const from: string =
    t1 === 'lolli' ? (interfaces.get(relation.id1) ?? relation.id1) : relation.id1;
  const to: string = t2 === 'lolli' ? (interfaces.get(relation.id2) ?? relation.id2) : relation.id2;
  return {
    id: relationId(taken, from, to),
    from,
    to,
    t1,
    t2,
    ...relationText(relation),
  };
}

function relationsFromDb(db: ClassDb): ClassRelation[] {
  const interfaces: Map<string, string> = new Map<string, string>(
    (db.interfaces ?? []).map((item: { id: string; label: string }) => [item.id, item.label]),
  );
  const relations: ClassRelation[] = [];
  for (const relation of db.getRelations()) {
    relations.push(relationFromDb(relation, interfaces, relations));
  }
  return relations;
}

function notesFromDb(db: ClassDb): ClassNote[] {
  const notes: ClassNote[] = [];
  for (const note of db.getNotes().values()) {
    const forId: string = note.class ?? '';
    notes.push({
      id: noteIdFor(notes, forId),
      text: decodeEntities(note.text),
      for: forId,
      ns: note.parent ?? '',
    });
  }
  return notes;
}

function headerOf(lines: readonly string[]): ClassHeader {
  const header: string =
    lines
      .map((line: string) => line.trim())
      .find((line: string) => line && !line.startsWith('%%')) ?? '';
  return /^classDiagram-v2\b/.test(header) ? 'classDiagram-v2' : 'classDiagram';
}

function modelFromDb(db: ClassDb, code: string): ClassModel {
  const { preamble, body } = splitPreamble(code);
  const lines: string[] = body.split('\n');
  const extra: string[] = keptLines(lines);
  const kept: Map<string, Set<string>> = keptCssClasses(extra);
  return {
    header: headerOf(lines),
    direction: directionOf(db.getDirection?.()),
    isDirExplicit: lines.some((line: string) => /^\s*direction\s+(TB|BT|LR|RL)\b/.test(line)),
    classes: [...db.getClasses().values()].map((item: DbClass) => classFromDb(item, kept)),
    namespaces: [...db.getNamespaces().values()].map(namespaceFromDb),
    relations: relationsFromDb(db),
    notes: notesFromDb(db),
    preamble,
    extra,
  };
}

// Mermaid rejects a classDiagram with no statements (the new-diagram template), so a bare
// header (plus an optional direction) is read as an empty diagram without asking Mermaid.
function statementLines(body: string): string[] {
  return body
    .split('\n')
    .map((line: string) => line.trim())
    .filter((line: string) => line && !line.startsWith('%%'));
}

function bareHeader(code: string): ClassModel | undefined {
  const { preamble, body } = splitPreamble(code);
  const rest: string[] = statementLines(body);
  const direction: RegExpExecArray | null = /^direction\s+(TB|BT|LR|RL)$/.exec(rest[1] ?? '');
  const isBare: boolean =
    rest.length === 1 || (rest.length === HEADER_AND_DIRECTION && direction !== null);
  const header: string = rest[0] ?? '';
  if (!isBare || (header !== 'classDiagram' && header !== 'classDiagram-v2')) {
    return undefined;
  }
  return {
    ...emptyModel(),
    header,
    preamble,
    direction: directionOf(direction?.[1]),
    isDirExplicit: direction !== null,
  };
}

/** Mermaid class diagram source to a model. Empty code is an empty model. */
export async function parse(code: string, load: DiagramLoader): Promise<ParseResult<ClassModel>> {
  if (!code.trim()) {
    return { kind: 'ok', model: emptyModel() };
  }
  const bare: ClassModel | undefined = bareHeader(code);
  if (bare) {
    return { kind: 'ok', model: bare };
  }
  return parseWithMermaid({
    code,
    load,
    type: /^class/,
    isDb: isClassDb,
    build: (db: ClassDb): ClassModel => modelFromDb(db, code),
  });
}

// ---- serialize ----

function classHead(item: ClassItem): string {
  const generic: string = item.generic ? `~${item.generic}~` : '';
  const label: string = item.label ? `["${quoteSafe(item.label)}"]` : '';
  const css: string = item.css[0] ? `:::${item.css[0]}` : '';
  return `class ${idSource(item.id)}${generic}${label}${css}`;
}

function classBody(item: ClassItem, indent: string): string[] {
  return [
    ...item.annotations.map((annotation: string) => `${indent}${INDENT}<<${annotation}>>`),
    ...item.attrs
      .filter((attr: ClassAttr) => attr.text)
      .map((attr: ClassAttr) => `${indent}${INDENT}${attrSource(attr)}`),
    ...item.methods
      .filter((method: ClassMethod) => method.name)
      .map((method: ClassMethod) => `${indent}${INDENT}${methodSource(method)}`),
  ];
}

// A class that relations already declare needs no line of its own.
function classLines(item: ClassItem, referenced: ReadonlySet<string>, indent: string): string[] {
  const hasBody: boolean = item.attrs.length + item.methods.length + item.annotations.length > 0;
  const isPlain: boolean = !hasBody && !item.label && !item.generic && item.css.length === 0;
  if (isPlain && referenced.has(item.id) && !item.ns) {
    return [];
  }
  if (!hasBody) {
    return [indent + classHead(item)];
  }
  return [`${indent}${classHead(item)} {`, ...classBody(item, indent), `${indent}}`];
}

function noteSource(note: ClassNote): string {
  const text: string = `"${quoteSafe(note.text)}"`;
  return note.for ? `note for ${idSource(note.for)} ${text}` : `note ${text}`;
}

function endSource(mark: ClassMark, end: string): string {
  return mark === 'lolli' ? end : idSource(end);
}

/** One relation as Mermaid source. */
export function relationSource(relation: ClassRelation): string {
  const op: string = `${LEFT[relation.t1]}${relation.line === 'dashed' ? '..' : '--'}${RIGHT[relation.t2]}`;
  const m1: string = relation.m1 ? ` "${quoteSafe(relation.m1)}"` : '';
  const m2: string = relation.m2 ? `"${quoteSafe(relation.m2)}" ` : '';
  const text: string = quoteSafe(relation.label)
    .replace(/:/g, '#colon;')
    .replace(/[\r\n]+/g, ' ');
  const label: string = relation.label ? ` : ${text}` : '';
  return `${endSource(relation.t1, relation.from)}${m1} ${op} ${m2}${endSource(relation.t2, relation.to)}${label}`;
}

function referencedIds(model: ClassModel): Set<string> {
  const referenced: Set<string> = new Set<string>();
  for (const relation of model.relations) {
    if (relation.t1 !== 'lolli') {
      referenced.add(relation.from);
    }
    if (relation.t2 !== 'lolli') {
      referenced.add(relation.to);
    }
  }
  return referenced;
}

/** Every namespace id with content or a declaration, implicit parents included, in v1's order. */
function namespaceOrder(model: ClassModel): string[] {
  const ids: Set<string> = new Set<string>([
    ...model.namespaces.map((namespace: ClassNamespace) => namespace.id),
    ...model.classes.map((item: ClassItem) => item.ns).filter(Boolean),
    ...model.notes.map((note: ClassNote) => note.ns).filter(Boolean),
  ]);
  for (const id of [...ids]) {
    for (let parent: string = nsParent(id); parent; parent = nsParent(parent)) {
      ids.add(parent);
    }
  }
  const declared: string[] = model.namespaces.map((namespace: ClassNamespace) => namespace.id);
  return [...new Set<string>([...declared, ...ids])].filter((id: string) => ids.has(id));
}

interface NamespaceContext {
  model: ClassModel;
  referenced: ReadonlySet<string>;
  order: readonly string[];
}

function isInside(ns: string, id: string): boolean {
  return ns === id || ns.startsWith(`${id}.`);
}

function hasContent(model: ClassModel, id: string): boolean {
  return (
    model.classes.some((item: ClassItem) => isInside(item.ns, id)) ||
    model.notes.some((note: ClassNote) => isInside(note.ns, id))
  );
}

function namespaceContent(context: NamespaceContext, id: string, inner: string): string[] {
  const { model, referenced, order } = context;
  return [
    ...model.classes
      .filter((item: ClassItem) => item.ns === id)
      .flatMap((item: ClassItem) => classLines(item, referenced, inner)),
    ...order
      .filter((child: string) => nsParent(child) === id)
      .flatMap((child: string) => namespaceLines(context, child, inner)),
    ...model.notes
      .filter((note: ClassNote) => note.ns === id)
      .map((note: ClassNote) => inner + noteSource(note)),
  ];
}

function namespaceLines(context: NamespaceContext, id: string, indent: string): string[] {
  if (!hasContent(context.model, id)) {
    return [];
  }
  const label: string =
    context.model.namespaces.find((namespace: ClassNamespace) => namespace.id === id)?.label ?? '';
  return [
    `${indent}namespace ${nsLeaf(id)}${label ? `["${quoteSafe(label)}"]` : ''} {`,
    ...namespaceContent(context, id, indent + INDENT),
    `${indent}}`,
  ];
}

function headerLines(model: ClassModel): string[] {
  const hasDirection: boolean = model.isDirExplicit || model.direction !== 'TB';
  return [
    ...(model.preamble ? [model.preamble.trimEnd()] : []),
    model.header,
    ...(hasDirection ? [`${INDENT}direction ${model.direction}`] : []),
  ];
}

// Extra css classes beyond the one written inline with `:::`.
function cssClassLines(model: ClassModel): string[] {
  return model.classes.flatMap((item: ClassItem) =>
    item.css.slice(1).map((css: string) => `${INDENT}cssClass "${item.id}" ${css}`),
  );
}

function bodyLines(model: ClassModel): string[] {
  const referenced: Set<string> = referencedIds(model);
  const context: NamespaceContext = { model, referenced, order: namespaceOrder(model) };
  return [
    ...model.classes
      .filter((item: ClassItem) => !item.ns)
      .flatMap((item: ClassItem) => classLines(item, referenced, INDENT)),
    ...context.order
      .filter((id: string) => !nsParent(id))
      .flatMap((id: string) => namespaceLines(context, id, INDENT)),
  ];
}

/** The model as Mermaid source. */
export function serialize(model: ClassModel): string {
  const lines: string[] = [
    ...headerLines(model),
    ...bodyLines(model),
    ...model.relations.map((relation: ClassRelation) => INDENT + relationSource(relation)),
    ...model.notes
      .filter((note: ClassNote) => !note.ns)
      .map((note: ClassNote) => INDENT + noteSource(note)),
    ...cssClassLines(model),
    ...model.extra.map((line: string) =>
      line
        .split('\n')
        .map((part: string) => INDENT + part)
        .join('\n'),
    ),
  ];
  return `${lines.join('\n')}\n`;
}

function uniqueAmong(model: ClassModel, prefix: string): string {
  const taken: Set<string> = new Set<string>([
    ...model.classes.map((item: ClassItem) => item.id),
    ...model.namespaces.map((namespace: ClassNamespace) => namespace.id),
  ]);
  let index: number = 1;
  while (taken.has(`${prefix}${String(index)}`)) {
    index++;
  }
  return `${prefix}${String(index)}`;
}

/** The first free class id `<prefix><n>` among classes and namespaces. */
export function uniqueClassId(model: ClassModel, prefix: string = 'Class'): string {
  return uniqueAmong(model, prefix);
}

/** The first free namespace id `<prefix><n>` among classes and namespaces. */
export function uniqueNsId(model: ClassModel, prefix: string = 'Namespace'): string {
  return uniqueAmong(model, prefix);
}

/** The toolbar kind of a relation, or 'custom' / 'lollipop'. */
export function kindOf(relation: ClassRelation): string {
  if (relation.t1 === 'lolli' || relation.t2 === 'lolli') {
    return 'lollipop';
  }
  const marks: ClassMark[] = [relation.t1, relation.t2].filter(
    (mark: ClassMark) => mark !== 'none',
  );
  if (marks.length > 1) {
    return 'custom';
  }
  const mark: ClassMark = marks[0] ?? 'none';
  return (
    KINDS.find((kind: RelationKind) => kind.line === relation.line && kind.mark === mark)?.id ??
    'custom'
  );
}

export function isAbstract(item: ClassItem): boolean {
  return item.annotations.some((annotation: string) => annotation.toLowerCase() === 'abstract');
}

export const classEditor: EditorModule<ClassModel> = { id: 'class', emptyModel, parse, serialize };
