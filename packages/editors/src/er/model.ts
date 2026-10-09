// erDiagram <-> ER model. Parsing reads Mermaid's own ER db; serializing writes Mermaid source
// back: subgraphs, relationships, entity declarations, subgraph classes, kept lines.
import { splitPreamble } from '@nautink/visual-core/preamble';
import { decodeText } from '@nautink/visual-core/text';

import { hasMethods, parseWithMermaid } from '../shared/mermaid-parse.ts';
import { parentMap } from '../shared/subgraphs.ts';
import { textAt } from '../shared/values.ts';

import type {
  DiagramLoader,
  EditorModule,
  ParseResult,
} from '@nautink/visual-core/editor-contract';

/** Cardinality as Mermaid's ErDB stores it. `MD_PARENT` (`u`) is only valid on the left end. */
export type Cardinality = 'ZERO_OR_ONE' | 'ONLY_ONE' | 'ZERO_OR_MORE' | 'ONE_OR_MORE' | 'MD_PARENT';
export type ErKey = 'PK' | 'FK' | 'UK';
export type ErDirection = 'TB' | 'LR' | 'BT' | 'RL';

export interface ErAttribute {
  type: string;
  name: string;
  keys: ErKey[];
  comment: string;
}

export interface ErEntity {
  name: string;
  alias: string;
  attributes: ErAttribute[];
  classes: string[];
}

/** A relationship from `from` to `to`; `fromCard` is the symbol next to `from`. */
export interface ErRelationship {
  id: string;
  from: string;
  to: string;
  fromCard: Cardinality;
  toCard: Cardinality;
  isIdentifying: boolean;
  label: string;
}

/** A subgraph. `members` holds entity and subgraph ids; inner subgraphs come first in the list. */
export interface ErSubgraph {
  id: string;
  title: string;
  members: string[];
  dir: string;
  classes: string[];
}

export interface ErModel {
  direction: ErDirection;
  entities: ErEntity[];
  rels: ErRelationship[];
  subgraphs: ErSubgraph[];
  preamble: string;
  extra: string[];
  accDescr: string;
}

export const CARDS: readonly Cardinality[] = [
  'ZERO_OR_ONE',
  'ONLY_ONE',
  'ZERO_OR_MORE',
  'ONE_OR_MORE',
];
export const CARD_NAMES: Readonly<Record<Cardinality, string>> = {
  ZERO_OR_ONE: 'Zero or one',
  ONLY_ONE: 'Exactly one',
  ZERO_OR_MORE: 'Zero or more',
  ONE_OR_MORE: 'One or more',
  MD_PARENT: 'Parent (u)',
};
export const KEYS: readonly ErKey[] = ['PK', 'FK', 'UK'];
export const DIRECTIONS: readonly ErDirection[] = ['TB', 'LR', 'BT', 'RL'];
export const DEFAULT_LABEL: string = 'relates';

const GENERIC_GROUP: number = 2;
const INDENT: string = '    ';
const FIRST_SUFFIX: number = 2;
const ALL_CARDS: readonly Cardinality[] = [...CARDS, 'MD_PARENT'];
// Symbol next to the left entity (A) and next to the right entity (B) in `A ||--o{ B`.
const LEFT: Readonly<Record<Cardinality, string>> = {
  ZERO_OR_ONE: '|o',
  ONLY_ONE: '||',
  ZERO_OR_MORE: '}o',
  ONE_OR_MORE: '}|',
  MD_PARENT: 'u',
};
const RIGHT: Readonly<Record<Cardinality, string>> = {
  ZERO_OR_ONE: 'o|',
  ONLY_ONE: '||',
  ZERO_OR_MORE: 'o{',
  ONE_OR_MORE: '|{',
  MD_PARENT: '||',
};
// Lines the model does not represent but must survive a round trip. `class` lines are
// represented (entity and subgraph classes), so they are not kept verbatim.
const KEEP_RE: RegExp = /^\s*(classDef|style|accTitle|accDescr\s*:)/;
// Words the ER lexer reads as keywords, so names starting with them must be quoted.
const RESERVED: RegExp =
  /^(one|many|zero|only|to|optionally|u|end|style|class|classdef|subgraph|direction|title|acctitle|accdescr|erdiagram)$/i;

export function emptyModel(): ErModel {
  return {
    direction: 'TB',
    entities: [],
    rels: [],
    subgraphs: [],
    preamble: '',
    extra: [],
    accDescr: '',
  };
}

/** Relationship id: the n-th relationship between the same two ends. */
export function relId(from: string, to: string, index: number): string {
  return `R_${from}_${to}_${String(index)}`;
}

export function displayName(entity: ErEntity): string {
  return entity.alias || entity.name;
}

// ---- Mermaid's ErDB, as far as parsing reads it ----

interface DbAttribute {
  type: string;
  name: string;
  keys?: string[];
  comment?: string;
}

interface DbEntity {
  id: string;
  alias?: string;
  attributes?: DbAttribute[];
  cssClasses?: string;
}

interface DbRelationship {
  entityA: string;
  entityB: string;
  roleA?: string;
  relSpec: { cardA: string; cardB: string; relType: string };
}

interface DbSubgraph {
  id: string;
  title?: string;
  nodes: string[];
  dir?: string;
  classes?: string[];
}

interface ErDb {
  getEntities: () => Map<string, DbEntity>;
  getRelationships: () => DbRelationship[];
  getSubGraphs: () => DbSubgraph[];
  getDirection?: () => string | undefined;
  getAccDescription?: () => string | undefined;
}

function isErDb(db: unknown): db is ErDb {
  return hasMethods(db, ['getEntities', 'getRelationships', 'getSubGraphs']);
}

function nextDepth(depth: number, line: string): number {
  return line.split('').reduce((level: number, char: string) => {
    if (char === '{') {
      return level + 1;
    }
    return char === '}' ? Math.max(0, level - 1) : level;
  }, depth);
}

// Keep-lines outside attribute blocks (a `style` attribute type is not a style line).
function keptLines(body: string): string[] {
  const out: string[] = [];
  let depth: number = 0;
  for (const line of body.split('\n')) {
    if (depth === 0 && KEEP_RE.test(line)) {
      out.push(line.trim());
    }
    // Ignore quoted text and the braces inside cardinality symbols (o{ |{ }o }|).
    depth = nextDepth(depth, line.replace(/"[^"]*"/g, '').replace(/\}[o|]|[o|]\{/g, ''));
  }
  return out;
}

function subgraphFromDb(subgraph: DbSubgraph): ErSubgraph {
  const hasTitle: boolean = Boolean(subgraph.title) && subgraph.title !== subgraph.id;
  return {
    id: subgraph.id,
    title: hasTitle ? decodeText(subgraph.title ?? '') : '',
    members: [...subgraph.nodes],
    dir: subgraph.dir ?? '',
    classes: [...new Set<string>(subgraph.classes ?? [])],
  };
}

function attributeFromDb(attribute: DbAttribute): ErAttribute {
  const keys: string[] = (attribute.keys ?? []).map((key: string) => key.toUpperCase());
  return {
    type: attribute.type,
    name: attribute.name,
    keys: KEYS.filter((key: ErKey) => keys.includes(key)),
    comment: decodeText(attribute.comment ?? ''),
  };
}

function entityFromDb(name: string, entity: DbEntity): ErEntity {
  const classes: string[] = (entity.cssClasses ?? '')
    .split(/\s+/)
    .filter((css: string) => css && css !== 'default');
  return {
    name,
    alias: decodeText(entity.alias ?? ''),
    attributes: (entity.attributes ?? []).map(attributeFromDb),
    classes: [...new Set<string>(classes)],
  };
}

function cardOf(value: string): Cardinality {
  return ALL_CARDS.find((card: Cardinality) => card === value) ?? 'ONLY_ONE';
}

function entityNames(db: ErDb): Map<string, string> {
  return new Map<string, string>(
    [...db.getEntities()].map(([name, entity]: [string, DbEntity]) => [entity.id, name]),
  );
}

// Mermaid keys entities by name; relationships point at entity.id (or a subgraph id).
function relationshipsFromDb(db: ErDb, groupIds: ReadonlySet<string>): ErRelationship[] {
  const nameById: Map<string, string> = entityNames(db);
  const endOf = (id: string): string => (groupIds.has(id) ? id : (nameById.get(id) ?? id));
  const counts: Map<string, number> = new Map<string, number>();
  return db.getRelationships().map((relationship: DbRelationship): ErRelationship => {
    const from: string = endOf(relationship.entityA);
    const to: string = endOf(relationship.entityB);
    const index: number = (counts.get(`${from}_${to}`) ?? -1) + 1;
    counts.set(`${from}_${to}`, index);
    // Mermaid stores the symbol next to entityA as cardB, the one next to entityB as cardA.
    return {
      id: relId(from, to, index),
      from,
      to,
      fromCard: cardOf(relationship.relSpec.cardB),
      toCard: cardOf(relationship.relSpec.cardA),
      isIdentifying: relationship.relSpec.relType !== 'NON_IDENTIFYING',
      label: decodeText(relationship.roleA ?? ''),
    };
  });
}

function directionOf(value: string | undefined): ErDirection {
  const direction: ErDirection | undefined = DIRECTIONS.find(
    (known: ErDirection) => known === value,
  );
  if (value && direction === undefined) {
    throw new Error(`Unknown ER diagram direction "${value}"`);
  }
  return direction ?? 'TB';
}

function modelFromDb(db: ErDb, code: string): ErModel {
  const { preamble, body } = splitPreamble(code);
  const subgraphs: ErSubgraph[] = db.getSubGraphs().map(subgraphFromDb);
  const groupIds: Set<string> = new Set<string>(
    subgraphs.map((subgraph: ErSubgraph) => subgraph.id),
  );
  // A relationship to a subgraph also registers a phantom entity, which is skipped.
  const entities: ErEntity[] = [...db.getEntities()]
    .filter(([name]: [string, DbEntity]) => !groupIds.has(name))
    .map(([name, entity]: [string, DbEntity]) => entityFromDb(name, entity));
  const hasAccDescrBlock: boolean = /^\s*accDescr\s*\{/m.test(body);
  return {
    direction: directionOf(db.getDirection?.()),
    entities,
    rels: relationshipsFromDb(db, groupIds),
    subgraphs,
    preamble,
    extra: keptLines(body),
    accDescr: hasAccDescrBlock ? decodeText(db.getAccDescription?.() ?? '') : '',
  };
}

/** Mermaid ER source to a model. Empty code is an empty model. */
export async function parse(code: string, load: DiagramLoader): Promise<ParseResult<ErModel>> {
  if (!code.trim()) {
    return { kind: 'ok', model: emptyModel() };
  }
  return parseWithMermaid({
    code,
    load,
    type: /^er$/,
    isDb: isErDb,
    build: (db: ErDb): ErModel => modelFromDb(db, code),
  });
}

// ---- sanitizers (the grammar has no escapes, so invalid characters are replaced) ----

export function cleanName(text: string): string {
  return text.replace(/["%\\\r\n]/g, '').trim();
}

export function cleanText(text: string): string {
  return text.replace(/[\r\n]+/g, ' ');
}

// Quoted text: Mermaid has no escapes, but decodes entity codes (`#quot;`).
function encode(text: string): string {
  return cleanText(text).replace(/"/g, '#quot;');
}

function encodeAlias(text: string): string {
  return encode(text.replace(/\\/g, '').trim()).replace(/%/g, '#37;');
}

function cleanWordPart(text: string): string {
  return text.replace(/[^A-Za-z0-9\-_[\]().,*À-￿]/g, '');
}

function cleanWordBody(text: string): string {
  const generic: RegExpExecArray | null = /^([^~]*)~([^~]*)~$/.exec(text);
  if (generic) {
    return `${cleanWordPart(textAt(generic, 1))}~${cleanWordPart(textAt(generic, GENERIC_GROUP))}~`;
  }
  return cleanWordPart(text) + (text.endsWith('?') ? '?' : '');
}

/** An attribute type or name as one ATTRIBUTE_WORD (generic `type~T~` and optional `type?` kept). */
export function cleanWord(text: string, fallback: string): string {
  const word: string = cleanWordBody(text.trim().replace(/\s+/g, '_'));
  if (!word || word === '?') {
    return fallback;
  }
  const safeStart: string = /^[*A-Za-z_À-￿]/.test(word) ? word : `_${word}`;
  return /^(PK|FK|UK)\b/i.test(safeStart) ? `_${safeStart}` : safeStart;
}

/** An entity or subgraph name: bare when the lexer reads it as one ENTITY_NAME, quoted otherwise. */
export function nameSource(name: string): string {
  const clean: string = cleanName(name);
  const isWord: boolean = /^[A-Za-z_][A-Za-z0-9_]*(-[A-Za-z0-9_]+)*$/.test(clean);
  return isWord && !RESERVED.test(clean.split('-')[0] ?? '') ? clean : `"${clean}"`;
}

function labelSource(label: string): string {
  const text: string = cleanText(label);
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(text) && !RESERVED.test(text) ? text : `"${encode(text)}"`;
}

function attributeSource(attribute: ErAttribute): string {
  const keys: ErKey[] = KEYS.filter((key: ErKey) => attribute.keys.includes(key));
  return [
    cleanWord(attribute.type, 'string'),
    cleanWord(attribute.name, 'field'),
    ...(keys.length ? [keys.join(', ')] : []),
    ...(attribute.comment ? [`"${encode(attribute.comment)}"`] : []),
  ].join(' ');
}

/** One relationship as Mermaid source. */
export function relSource(relationship: ErRelationship): string {
  const line: string = relationship.isIdentifying ? '--' : '..';
  const op: string = `${LEFT[relationship.fromCard]}${line}${RIGHT[relationship.toCard]}`;
  return `${nameSource(relationship.from)} ${op} ${nameSource(relationship.to)} : ${labelSource(relationship.label)}`;
}

// Declaration lines for one entity, or none when relationships already declare it.
function entityLines(entity: ErEntity, indent: string, isForced: boolean): string[] {
  const alias: string = entity.alias ? `["${encodeAlias(entity.alias)}"]` : '';
  const classes: string = entity.classes.length ? `:::${entity.classes.join(',')}` : '';
  const head: string = nameSource(entity.name) + alias + classes;
  if (entity.attributes.length) {
    return [
      `${indent}${head} {`,
      ...entity.attributes.map(
        (attribute: ErAttribute) => `${indent}${INDENT}${attributeSource(attribute)}`,
      ),
      `${indent}}`,
    ];
  }
  return isForced || alias || classes ? [indent + head] : [];
}

interface EmitContext {
  model: ErModel;
  parent: Map<string, string>;
}

function subgraphLines(context: EmitContext, subgraph: ErSubgraph, indent: string): string[] {
  const { model, parent } = context;
  const title: string = subgraph.title ? ` ["${encodeAlias(subgraph.title)}"]` : '';
  const inner: string = indent + INDENT;
  return [
    `${indent}subgraph ${nameSource(subgraph.id)}${title}`,
    ...(subgraph.dir ? [`${inner}direction ${subgraph.dir}`] : []),
    ...model.entities
      .filter((entity: ErEntity) => parent.get(entity.name) === subgraph.id)
      .flatMap((entity: ErEntity) => entityLines(entity, inner, true)),
    ...model.subgraphs
      .filter((child: ErSubgraph) => parent.get(child.id) === subgraph.id)
      .flatMap((child: ErSubgraph) => subgraphLines(context, child, inner)),
    `${indent}end`,
  ];
}

function mentionOrder(model: ErModel): Map<string, number> {
  const rank: Map<string, number> = new Map<string, number>();
  for (const relationship of model.rels) {
    for (const name of [relationship.from, relationship.to]) {
      rank.set(name, rank.get(name) ?? rank.size);
    }
  }
  return rank;
}

// Declarations follow first mention in the relationships, which is the order Mermaid reads
// entities back in, so a round trip does not reshuffle them.
function topLevelEntityLines(context: EmitContext): string[] {
  const rank: Map<string, number> = mentionOrder(context.model);
  const linked: number = rank.size;
  return context.model.entities
    .filter((entity: ErEntity) => !context.parent.has(entity.name))
    .map((entity: ErEntity, index: number) => ({
      entity,
      order: rank.get(entity.name) ?? linked + index,
    }))
    .sort((a: { order: number }, b: { order: number }) => a.order - b.order)
    .flatMap(({ entity }: { entity: ErEntity }) =>
      entityLines(entity, INDENT, !rank.has(entity.name)),
    );
}

function headerLines(model: ErModel): string[] {
  const accDescr: string[] = model.accDescr
    ? [
        `${INDENT}accDescr {`,
        ...model.accDescr.split('\n').map((line: string) => `${INDENT}${INDENT}${line.trim()}`),
        `${INDENT}}`,
      ]
    : [];
  return [
    ...(model.preamble ? [model.preamble.trimEnd()] : []),
    'erDiagram',
    ...(model.direction !== 'TB' ? [`${INDENT}direction ${model.direction}`] : []),
    ...accDescr,
  ];
}

/** The model as Mermaid source. Subgraphs come first: a relationship can only point at a subgraph after its `end`. */
export function serialize(model: ErModel): string {
  const context: EmitContext = { model, parent: parentMap(model.subgraphs) };
  const lines: string[] = [
    ...headerLines(model),
    ...model.subgraphs
      .filter((subgraph: ErSubgraph) => !context.parent.has(subgraph.id))
      .flatMap((subgraph: ErSubgraph) => subgraphLines(context, subgraph, INDENT)),
    ...model.rels.map((relationship: ErRelationship) => INDENT + relSource(relationship)),
    ...topLevelEntityLines(context),
    ...model.subgraphs
      .filter((subgraph: ErSubgraph) => subgraph.classes.length)
      .map(
        (subgraph: ErSubgraph) =>
          `${INDENT}class ${nameSource(subgraph.id)} ${subgraph.classes.join(',')}`,
      ),
    ...model.extra.map((line: string) => INDENT + line),
  ];
  return `${lines.join('\n')}\n`;
}

/** `prefix` when free, else the first free `<prefix>_<n>` from 2, among entities and subgraphs. */
export function uniqueName(model: ErModel, prefix: string = 'ENTITY'): string {
  const taken: Set<string> = new Set<string>([
    ...model.entities.map((entity: ErEntity) => entity.name),
    ...model.subgraphs.map((subgraph: ErSubgraph) => subgraph.id),
  ]);
  if (!taken.has(prefix)) {
    return prefix;
  }
  let index: number = FIRST_SUFFIX;
  while (taken.has(`${prefix}_${String(index)}`)) {
    index++;
  }
  return `${prefix}_${String(index)}`;
}

export const erEditor: EditorModule<ErModel> = { id: 'er', emptyModel, parse, serialize };
