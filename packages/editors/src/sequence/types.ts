// The sequence editor's model: participants, boxes and a tree of items. Mermaid's db gives a flat
// message list with block control entries; parsing folds it into this tree.

export type ParticipantKind =
  | 'participant'
  | 'actor'
  | 'boundary'
  | 'control'
  | 'entity'
  | 'database'
  | 'collections'
  | 'queue';

export type BlockKind = 'loop' | 'alt' | 'opt' | 'par' | 'par_over' | 'critical' | 'break' | 'rect';

export type HeadKind =
  | 'arrow'
  | 'open'
  | 'cross'
  | 'async'
  | 'bi'
  | 'halfTop'
  | 'halfBottom'
  | 'stickTop'
  | 'stickBottom'
  | 'halfTopRev'
  | 'halfBottomRev'
  | 'stickTopRev'
  | 'stickBottomRev';

export type LineStyle = 'solid' | 'dotted';
export type NotePlacement = 'left' | 'right' | 'over';
/** Activation shorthand on a message: `+` activates the target, `-` deactivates the source. */
export type Activation = '' | '+' | '-';
/** Central connection `()` on a message end. */
export type Central = '' | 'to' | 'from' | 'both';

export interface Participant {
  id: string;
  label: string;
  kind: ParticipantKind;
  box: string | null;
  isCreated: boolean;
}

export interface SequenceBox {
  id: string;
  name: string;
  fill: string;
}

/** `autonumber`: start and step when given, and whether numbers show. */
export interface Autonumber {
  start?: number;
  step?: number;
  isVisible: boolean;
}

/** `shouldWrap` is set only when it differs from the diagram's default (`wrap:` / `nowrap:`). */
export interface MessageItem {
  t: 'msg';
  id: string;
  from: string;
  to: string;
  text: string;
  line: LineStyle;
  head: HeadKind;
  act: Activation;
  central: Central;
  create: string[];
  destroy: string[];
  shouldWrap?: boolean;
}

export interface NoteItem {
  t: 'note';
  id: string;
  placement: NotePlacement;
  actors: string[];
  text: string;
  shouldWrap?: boolean;
}

/** An explicit `activate` / `deactivate`. */
export interface ActivationItem {
  t: 'act';
  id: string;
  actor: string;
  isOn: boolean;
}

/** An `autonumber` after the first message. */
export interface AutonumberItem extends Autonumber {
  t: 'autonumber';
  id: string;
}

export interface Section {
  label: string;
  items: SequenceItem[];
}

export interface BlockItem {
  t: 'block';
  id: string;
  kind: BlockKind;
  sections: Section[];
}

export type SequenceItem = MessageItem | NoteItem | ActivationItem | AutonumberItem | BlockItem;

export interface SequenceModel {
  preamble: string;
  /** Raw title, accTitle and accDescr lines. */
  head: string[];
  /** Raw link, links, properties and details lines. */
  extra: string[];
  /** A leading `autonumber`. */
  autonumber: Autonumber | null;
  participants: Participant[];
  boxes: SequenceBox[];
  items: SequenceItem[];
}
