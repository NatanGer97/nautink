// Sequence diagram <-> tree model. Parsing reads Mermaid's own sequence db (see parse.ts);
// serializing writes Mermaid source back: header lines, declarations, items, kept lines.
import { splitPreamble } from '@nautink/visual-core/preamble';

import { BLOCKS, HEADS } from './constants.ts';
import { isCssColor } from './css-colors.ts';
import { participantsFromDb, SequenceWalker } from './parse.ts';
import { esc } from './text.ts';
import { hasMethods, parseWithMermaid } from '../shared/mermaid-parse.ts';
import { textOr } from '../shared/values.ts';

import type { SequenceDb } from './parse.ts';
import type {
  Autonumber,
  BlockItem,
  MessageItem,
  NoteItem,
  Participant,
  SequenceBox,
  SequenceItem,
  SequenceModel,
} from './types.ts';
import type {
  DiagramLoader,
  EditorModule,
  ParseResult,
} from '@nautink/visual-core/editor-contract';

const INDENT: string = '    ';
const ID_RADIX: number = 36;
// Header lines kept verbatim (after `sequenceDiagram`) and trailing lines kept verbatim.
const HEAD_RE: RegExp = /^\s*(title[\s:]|accTitle\s*:|accDescr\s*:)/;
const EXTRA_RE: RegExp = /^\s*(links?|properties|details)\s+[^:]+:/;

export function emptyModel(): SequenceModel {
  return {
    preamble: '',
    head: [],
    extra: [],
    autonumber: null,
    participants: [],
    boxes: [],
    items: [],
  };
}

// ---- parse ----

function isSequenceDb(db: unknown): db is SequenceDb {
  return hasMethods(db, [
    'autoWrap',
    'getBoxes',
    'getActors',
    'getMessages',
    'getCreatedActors',
    'getDestroyedActors',
  ]);
}

function blockEnd(lines: readonly string[], start: number): number {
  let end: number = start;
  while (!(lines[end] ?? '').includes('}') && end + 1 < lines.length) {
    end++;
  }
  return end;
}

// title, accTitle and accDescr lines, multi-line `accDescr { ... }` blocks included.
function headLines(lines: readonly string[]): string[] {
  const head: string[] = [];
  for (let index: number = 0; index < lines.length; index++) {
    const line: string = lines[index] ?? '';
    if (/^\s*accDescr\s*\{/.test(line)) {
      const end: number = blockEnd(lines, index);
      head.push(
        lines
          .slice(index, end + 1)
          .map((part: string) => part.trim())
          .join('\n'),
      );
      index = end;
    } else if (HEAD_RE.test(line)) {
      head.push(line.trim());
    }
  }
  return head;
}

function modelFromDb(db: SequenceDb, code: string): SequenceModel {
  const { preamble, body } = splitPreamble(code);
  const lines: string[] = body.split('\n');
  const walker: SequenceWalker = new SequenceWalker(db);
  const items: SequenceItem[] = walker.items();
  return {
    preamble,
    head: headLines(lines),
    extra: lines.filter((line: string) => EXTRA_RE.test(line)).map((line: string) => line.trim()),
    autonumber: walker.autonumber,
    ...participantsFromDb(db),
    items,
  };
}

/** Mermaid sequence diagram source to a model. */
export async function parse(
  code: string,
  load: DiagramLoader,
): Promise<ParseResult<SequenceModel>> {
  return parseWithMermaid({
    code,
    load,
    type: /^sequence$/,
    isDb: isSequenceDb,
    build: (db: SequenceDb): SequenceModel => modelFromDb(db, code),
  });
}

// ---- serialize ----

function isPlain(participant: Participant): boolean {
  return (
    participant.kind === 'participant' && participant.label === participant.id && !participant.box
  );
}

/** A participant declaration: `participant A as Label`, `actor A`, or a typed participant. */
export function declSource(participant: Participant): string {
  const alias: string =
    participant.label !== participant.id && participant.label !== ''
      ? ` as ${esc(participant.label)}`
      : '';
  if (participant.kind === 'actor' || participant.kind === 'participant') {
    return `${participant.kind} ${participant.id}${alias}`;
  }
  return `participant ${participant.id}@{ "type": "${participant.kind}" }${alias}`;
}

export function arrowToken(message: Pick<MessageItem, 'head' | 'line'>): string {
  return HEADS[message.head].token(message.line === 'dotted' ? '--' : '-');
}

function wrapPrefix(shouldWrap: boolean | undefined): string {
  if (shouldWrap === undefined) {
    return '';
  }
  return shouldWrap ? 'wrap:' : 'nowrap:';
}

/** One message as Mermaid source. */
export function msgSource(message: MessageItem): string {
  const before: string = message.central === 'from' || message.central === 'both' ? '()' : '';
  const after: string = message.central === 'to' || message.central === 'both' ? '()' : '';
  const act: string = message.central ? '' : message.act;
  const wrap: string = wrapPrefix(message.shouldWrap);
  const text: string = esc(message.text);
  const space: string = wrap || text ? ' ' : '';
  return `${message.from}${before}${arrowToken(message)}${act}${after}${message.to}:${space}${wrap}${text}`;
}

/** One note as Mermaid source. */
export function noteSource(note: NoteItem): string {
  const where: string = note.placement === 'over' ? 'over' : `${note.placement} of`;
  return `Note ${where} ${note.actors.join(',')}: ${wrapPrefix(note.shouldWrap)}${esc(note.text)}`;
}

function autonumberSource(autonumber: Autonumber): string {
  if (!autonumber.isVisible) {
    return 'autonumber off';
  }
  if (autonumber.start === undefined) {
    return 'autonumber';
  }
  const step: string =
    autonumber.step === undefined || autonumber.step === 1 ? '' : ` ${String(autonumber.step)}`;
  return `autonumber ${String(autonumber.start)}${step}`;
}

function mentionedIds(item: SequenceItem): string[] {
  if (item.t === 'msg') {
    return [...item.create, item.from, item.to];
  }
  if (item.t === 'note') {
    return item.actors;
  }
  return item.t === 'block'
    ? item.sections.flatMap((section: { items: SequenceItem[] }) =>
        section.items.flatMap(mentionedIds),
      )
    : [];
}

// The order Mermaid gives participants if only `declared` are declared up front.
function implicitOrder(model: SequenceModel, declared: readonly string[]): string[] {
  return [...new Set<string>([...declared, ...model.items.flatMap(mentionedIds)])];
}

// Every participant up to the last one that needs a declaration line of its own.
function minimumDeclared(normal: readonly Participant[]): number {
  return normal.reduce(
    (last: number, participant: Participant, index: number) =>
      isPlain(participant) ? last : index + 1,
    0,
  );
}

// Declares as few participants as needed to keep the model's order.
function declaredParticipants(model: SequenceModel): Participant[] {
  const normal: Participant[] = model.participants.filter(
    (participant: Participant) => !participant.isCreated,
  );
  const want: string = model.participants
    .map((participant: Participant) => participant.id)
    .join('\n');
  for (let count: number = minimumDeclared(normal); count <= normal.length; count++) {
    const declared: string[] = normal
      .slice(0, count)
      .map((participant: Participant) => participant.id);
    if (implicitOrder(model, declared).join('\n') === want) {
      return normal.slice(0, count);
    }
  }
  return normal;
}

/** Answers whether a word is a CSS color; Mermaid reads such a first word of a box title as its fill. */
export type ColorCheck = (word: string) => boolean;

function boxHeader(box: SequenceBox, isColor: ColorCheck): string {
  const name: string = esc(box.name);
  const fill: string = textOr(box.fill, 'transparent');
  if (fill !== 'transparent') {
    return `box ${fill}${name ? ` ${name}` : ''}`;
  }
  if (!name) {
    return 'box';
  }
  const first: string = name.split(/\s+/)[0] ?? '';
  return isColor(first) || /^(rgba?|hsla?)\s*\(/i.test(name)
    ? `box transparent ${name}`
    : `box ${name}`;
}

function declarationLines(model: SequenceModel, isColor: ColorCheck): string[] {
  const lines: string[] = [];
  let open: SequenceBox | null = null;
  for (const participant of declaredParticipants(model)) {
    const box: SequenceBox | null =
      model.boxes.find((candidate: SequenceBox) => candidate.id === participant.box) ?? null;
    if (box !== open) {
      lines.push(
        ...(open ? [`${INDENT}end`] : []),
        ...(box ? [INDENT + boxHeader(box, isColor)] : []),
      );
      open = box;
    }
    lines.push((open ? INDENT + INDENT : INDENT) + declSource(participant));
  }
  return open ? [...lines, `${INDENT}end`] : lines;
}

function messageLines(model: SequenceModel, message: MessageItem, indent: string): string[] {
  const created: Participant[] = message.create.flatMap((id: string) =>
    model.participants.filter((participant: Participant) => participant.id === id).slice(0, 1),
  );
  return [
    ...created.map((participant: Participant) => `${indent}create ${declSource(participant)}`),
    ...message.destroy.map((id: string) => `${indent}destroy ${id}`),
    indent + msgSource(message),
  ];
}

function blockLines(model: SequenceModel, block: BlockItem, indent: string): string[] {
  const more: string = BLOCKS[block.kind].more ?? 'else';
  return [
    ...block.sections.flatMap(
      (section: { label: string; items: SequenceItem[] }, index: number) => {
        const label: string = block.kind === 'rect' ? section.label.trim() : esc(section.label);
        return [
          `${indent}${index === 0 ? block.kind : more}${label ? ` ${label}` : ''}`,
          ...itemLines(model, section.items, indent + INDENT),
        ];
      },
    ),
    `${indent}end`,
  ];
}

function itemLines(model: SequenceModel, items: readonly SequenceItem[], indent: string): string[] {
  return items.flatMap((item: SequenceItem): string[] => {
    switch (item.t) {
      case 'msg':
        return messageLines(model, item, indent);
      case 'note':
        return [indent + noteSource(item)];
      case 'act':
        return [`${indent}${item.isOn ? 'activate' : 'deactivate'} ${item.actor}`];
      case 'autonumber':
        return [indent + autonumberSource(item)];
      default:
        return blockLines(model, item, indent);
    }
  });
}

/** The model as Mermaid source, with a custom check for color words in box titles. */
export function serializeWith(model: SequenceModel, { isColor }: { isColor: ColorCheck }): string {
  const lines: string[] = [
    ...(model.preamble ? [model.preamble.trimEnd()] : []),
    'sequenceDiagram',
    ...model.head.flatMap((line: string) =>
      line.split('\n').map((part: string) => INDENT + part.trim()),
    ),
    ...(model.autonumber ? [INDENT + autonumberSource(model.autonumber)] : []),
    ...declarationLines(model, isColor),
    ...itemLines(model, model.items, INDENT),
    ...model.extra.map((line: string) => INDENT + line),
  ];
  return `${lines.join('\n')}\n`;
}

/** The model as Mermaid source. */
export function serialize(model: SequenceModel): string {
  return serializeWith(model, { isColor: isCssColor });
}

// ---- tree helpers ----

/** One item of the tree, where it sits, and how deep. */
export interface ItemVisit {
  item: SequenceItem;
  list: SequenceItem[];
  index: number;
  parent: BlockItem | null;
  sectionIndex: number;
  depth: number;
}

function visitList(
  items: SequenceItem[],
  visit: (entry: ItemVisit) => void,
  place: Pick<ItemVisit, 'parent' | 'sectionIndex' | 'depth'>,
): void {
  items.forEach((item: SequenceItem, index: number) => {
    visit({ item, list: items, index, ...place });
    if (item.t === 'block') {
      item.sections.forEach((section: { items: SequenceItem[] }, sectionIndex: number) => {
        visitList(section.items, visit, { parent: item, sectionIndex, depth: place.depth + 1 });
      });
    }
  });
}

/** Visits every item, depth first, in source order. */
export function walkItems(items: SequenceItem[], visit: (entry: ItemVisit) => void): void {
  visitList(items, visit, { parent: null, sectionIndex: 0, depth: 0 });
}

/** Where an item sits in the tree, or null when there is no such item. */
export function findItem(model: SequenceModel, id: string): ItemVisit | null {
  let hit: ItemVisit | null = null;
  walkItems(model.items, (entry: ItemVisit) => {
    if (entry.item.id === id) {
      hit = entry;
    }
  });
  return hit;
}

/** Key of the list an item sits in: 'root' or `<blockId>:<sectionIndex>`. */
export function listKey(parent: BlockItem | null, sectionIndex: number): string {
  return parent ? `${parent.id}:${String(sectionIndex)}` : 'root';
}

/** `base` when free (and not the default 'P'), else the first free `<base><n>`. */
export function uniqueParticipantId(model: SequenceModel, base: string = 'P'): string {
  const taken: Set<string> = new Set<string>(
    model.participants.map((participant: Participant) => participant.id),
  );
  if (!taken.has(base) && base !== 'P') {
    return base;
  }
  let index: number = 1;
  while (taken.has(`${base}${String(index)}`)) {
    index++;
  }
  return `${base}${String(index)}`;
}

let sequence: number = 0;

/** A fresh item id for items added in the editor (parsed items are `i0`, `i1`, …). */
export function newId(): string {
  const id: string = `n${Date.now().toString(ID_RADIX)}${sequence.toString(ID_RADIX)}`;
  sequence++;
  return id;
}

export const sequenceEditor: EditorModule<SequenceModel> = {
  id: 'sequence',
  emptyModel,
  parse,
  serialize,
};
