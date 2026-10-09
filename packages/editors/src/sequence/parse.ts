// Folds Mermaid's flat sequence message list (with block control entries) into the item tree.
import { BLOCK_END, BLOCK_MORE, BLOCK_START, CENTRAL, KINDS, LINE_TYPES } from './constants.ts';
import { decode } from './text.ts';
import { textOr } from '../shared/values.ts';

import type {
  Autonumber,
  BlockItem,
  BlockKind,
  Central,
  HeadKind,
  LineStyle,
  MessageItem,
  NotePlacement,
  Participant,
  ParticipantKind,
  Section,
  SequenceBox,
  SequenceItem,
} from './types.ts';

/** Autonumber settings as Mermaid stores them in an AUTONUMBER message. */
interface DbAutonumber {
  start?: number;
  step?: number;
  visible?: unknown;
}

/** One entry of Mermaid's message list, as far as parsing reads it. */
export interface DbMessage {
  type?: number;
  from?: string;
  to?: string;
  message?: string | DbAutonumber;
  placement?: number;
  wrap?: unknown;
  activate?: unknown;
  centralConnection?: number;
}

export interface DbActor {
  description?: string;
  type?: string;
  box?: object;
}

export interface DbBox {
  name?: string;
  fill?: string;
}

/** Mermaid's SequenceDB, as far as parsing reads it (plus its `LINETYPE` table, see lineTypes). */
export interface SequenceDb {
  autoWrap: () => boolean;
  getBoxes: () => DbBox[];
  getActors: () => Map<string, DbActor>;
  getMessages: () => DbMessage[];
  getCreatedActors: () => Map<string, number>;
  getDestroyedActors: () => Map<string, number>;
}

const PLACEMENTS: readonly NotePlacement[] = ['left', 'right', 'over'];

/** The LINETYPE codes parsing compares against, read from the db's own table. */
export interface LineTypeCodes {
  autonumber: number;
  note: number;
  activeStart: number;
  activeEnd: number;
}

function codeIn(table: unknown, name: string): number {
  const code: unknown =
    typeof table === 'object' && table !== null ? Reflect.get(table, name) : undefined;
  if (typeof code !== 'number') {
    throw new Error(`Mermaid's sequence db has no LINETYPE.${name}`);
  }
  return code;
}

/** Reads the codes from `db.LINETYPE`. Throws when Mermaid did not provide them. */
export function lineTypes(db: object): LineTypeCodes {
  const table: unknown = Reflect.get(db, 'LINETYPE');
  return {
    autonumber: codeIn(table, 'AUTONUMBER'),
    note: codeIn(table, 'NOTE'),
    activeStart: codeIn(table, 'ACTIVE_START'),
    activeEnd: codeIn(table, 'ACTIVE_END'),
  };
}

function textOf(message: DbMessage): string {
  return decode(typeof message.message === 'string' ? message.message : undefined);
}

function codeOf(message: DbMessage | undefined): string {
  return String(message?.type);
}

/** Actors grouped by the index of the message that creates (or destroys) them. */
function byIndex(map: ReadonlyMap<string, number>): Map<number, string[]> {
  const out: Map<number, string[]> = new Map<number, string[]>();
  for (const [id, index] of map) {
    out.set(index, [...(out.get(index) ?? []), id]);
  }
  return out;
}

function boxesFromDb(raw: readonly DbBox[]): SequenceBox[] {
  return raw.map((box: DbBox, index: number) => ({
    id: `box${String(index + 1)}`,
    name: decode(box.name),
    fill: textOr(box.fill, 'transparent'),
  }));
}

interface ActorContext {
  raw: readonly DbBox[];
  boxes: readonly SequenceBox[];
  created: ReadonlyMap<string, number>;
}

function participantFrom(id: string, actor: DbActor, context: ActorContext): Participant {
  const box: number = actor.box ? context.raw.indexOf(actor.box) : -1;
  const kind: ParticipantKind =
    KINDS.find((known: ParticipantKind) => known === actor.type) ?? 'participant';
  return {
    id,
    label: decode(actor.description ?? id),
    kind,
    box: context.boxes[box]?.id ?? null,
    isCreated: context.created.has(id),
  };
}

/** Participants and the boxes that hold at least one of them. */
export function participantsFromDb(db: SequenceDb): {
  participants: Participant[];
  boxes: SequenceBox[];
} {
  const raw: DbBox[] = db.getBoxes();
  const context: ActorContext = { raw, boxes: boxesFromDb(raw), created: db.getCreatedActors() };
  const participants: Participant[] = [...db.getActors()].map(([id, actor]: [string, DbActor]) =>
    participantFrom(id, actor, context),
  );
  const used: Set<string | null> = new Set<string | null>(
    participants.map((participant: Participant) => participant.box),
  );
  return { participants, boxes: context.boxes.filter((box: SequenceBox) => used.has(box.id)) };
}

/** Walks the message list once, building the item tree. */
export class SequenceWalker {
  autonumber: Autonumber | null = null;
  readonly #db: SequenceDb;
  readonly #codes: LineTypeCodes;
  readonly #messages: DbMessage[];
  readonly #createdAt: Map<number, string[]>;
  readonly #destroyedAt: Map<number, string[]>;
  readonly #root: SequenceItem[] = [];
  readonly #stack: { block: BlockItem | null; section: Section }[] = [];
  #nextId: number = 0;
  #index: number = 0;
  #hasSeenMessage: boolean = false;
  #pendingCreate: string[] = [];
  #pendingDestroy: string[] = [];

  constructor(db: SequenceDb) {
    this.#db = db;
    this.#codes = lineTypes(db);
    this.#messages = db.getMessages();
    this.#createdAt = byIndex(db.getCreatedActors());
    this.#destroyedAt = byIndex(db.getDestroyedActors());
    this.#stack.push({ block: null, section: { label: '', items: this.#root } });
  }

  /** The item tree of the whole message list. */
  items(): SequenceItem[] {
    for (this.#index = 0; this.#index < this.#messages.length; this.#index++) {
      this.#visit(this.#messages[this.#index] ?? {});
    }
    return this.#root;
  }

  #id(): string {
    const id: string = `i${String(this.#nextId)}`;
    this.#nextId++;
    return id;
  }

  #current(): SequenceItem[] {
    return this.#stack.at(-1)?.section.items ?? this.#root;
  }

  #wrapOf(wrap: unknown): Partial<{ shouldWrap: boolean }> {
    return typeof wrap === 'boolean' && wrap !== this.#db.autoWrap() ? { shouldWrap: wrap } : {};
  }

  #visit(message: DbMessage): void {
    this.#pendingCreate.push(...(this.#createdAt.get(this.#index) ?? []));
    this.#pendingDestroy.push(...(this.#destroyedAt.get(this.#index) ?? []));
    if (message.type === this.#codes.autonumber) {
      this.#autonumber(message);
      return;
    }
    this.#hasSeenMessage = true;
    if (message.type === this.#codes.note) {
      this.#note(message);
    } else if (message.type === this.#codes.activeStart || message.type === this.#codes.activeEnd) {
      this.#activate(message);
    } else {
      this.#control(message);
    }
  }

  #activate(message: DbMessage): void {
    const isOn: boolean = message.type === this.#codes.activeStart;
    this.#current().push({ t: 'act', id: this.#id(), actor: message.from ?? '', isOn });
  }

  #autonumber(message: DbMessage): void {
    const settings: DbAutonumber = typeof message.message === 'object' ? message.message : {};
    const autonumber: Autonumber = {
      ...(settings.start === undefined ? {} : { start: settings.start }),
      ...(settings.step === undefined ? {} : { step: settings.step }),
      isVisible: settings.visible !== false,
    };
    if (!this.#hasSeenMessage && !this.autonumber) {
      this.autonumber = autonumber;
      return;
    }
    this.#current().push({ t: 'autonumber', id: this.#id(), ...autonumber });
  }

  #note(message: DbMessage): void {
    const placement: NotePlacement = PLACEMENTS[message.placement ?? -1] ?? 'over';
    const from: string = message.from ?? '';
    const isSingle: boolean = message.from === message.to || placement !== 'over';
    const actors: string[] = isSingle ? [from] : [from, message.to ?? ''];
    this.#current().push({
      t: 'note',
      id: this.#id(),
      placement,
      actors,
      text: textOf(message),
      ...this.#wrapOf(message.wrap),
    });
  }

  #control(message: DbMessage): void {
    const code: string = codeOf(message);
    const start: BlockKind | undefined = BLOCK_START.get(code);
    const line: readonly [LineStyle, HeadKind] | undefined = LINE_TYPES.get(code);
    if (start) {
      this.#openBlock(start, message);
    } else if (BLOCK_MORE.has(code)) {
      this.#addSection(message);
    } else if (BLOCK_END.has(code) && this.#stack.length > 1) {
      this.#stack.pop();
    } else if (line) {
      this.#message(message, line);
    }
  }

  #openBlock(kind: BlockKind, message: DbMessage): void {
    const section: Section = { label: textOf(message), items: [] };
    const block: BlockItem = { t: 'block', id: this.#id(), kind, sections: [section] };
    this.#current().push(block);
    this.#stack.push({ block, section });
  }

  #addSection(message: DbMessage): void {
    const top: { block: BlockItem | null; section: Section } | undefined = this.#stack.at(-1);
    if (!top?.block) {
      return;
    }
    const section: Section = { label: textOf(message), items: [] };
    top.block.sections.push(section);
    top.section = section;
  }

  #message(message: DbMessage, [line, head]: readonly [LineStyle, HeadKind]): void {
    const central: Central = CENTRAL.get(String(message.centralConnection)) ?? '';
    const item: MessageItem = {
      t: 'msg',
      id: this.#id(),
      from: message.from ?? '',
      to: message.to ?? '',
      text: textOf(message),
      line,
      head,
      act: central ? '' : this.#activation(message),
      central,
      create: this.#pendingCreate,
      destroy: this.#pendingDestroy,
      ...this.#wrapOf(message.wrap),
    };
    this.#resetPending();
    this.#skipCentralMarkers();
    this.#current().push(item);
  }

  #resetPending(): void {
    this.#pendingCreate = [];
    this.#pendingDestroy = [];
  }

  // `A->>+B` comes back as a message plus an activation entry; fold the entry into the message.
  #activation(message: DbMessage): '' | '+' | '-' {
    const next: DbMessage = this.#messages[this.#index + 1] ?? {};
    if (message.activate && next.type === this.#codes.activeStart && next.from === message.to) {
      this.#index++;
      return '+';
    }
    if (next.type === this.#codes.activeEnd && next.from === message.from) {
      this.#index++;
      return '-';
    }
    return '';
  }

  #skipCentralMarkers(): void {
    const isMarker = (next: DbMessage | undefined): boolean =>
      CENTRAL.has(codeOf(next)) && (next?.from ?? null) !== null && !next?.to;
    while (isMarker(this.#messages[this.#index + 1])) {
      this.#index++;
    }
  }
}
