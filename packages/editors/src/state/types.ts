// The state editor's model.
//
// A state's `parent` is a scope: null (top level), a composite id, or a region scope `X#i`. A
// composite with `regions` > 0 has concurrent regions `X#0`..`X#n-1` that hold its children.
// Transition ends are state ids or pseudo ids (`start:<scope>`, `end:<scope>`) for `[*]`.

export type StateType = 'state' | 'choice' | 'fork' | 'join';
export type StateDirection = '' | 'TB' | 'BT' | 'LR' | 'RL';
export type StateHeader = 'stateDiagram-v2' | 'stateDiagram';
export type NoteSide = 'left' | 'right';

export interface StateNode {
  id: string;
  type: StateType;
  isComposite: boolean;
  regions: number;
  name: string;
  desc: string[];
  parent: string | null;
  classes: string[];
  dir: string;
}

export interface StateTransition {
  id: string;
  from: string;
  to: string;
  label: string;
}

export interface StateNote {
  id: string;
  target: string;
  side: NoteSide;
  text: string;
}

/** A `style` line: the states it applies to and its CSS. */
export interface StateStyle {
  ids: string[];
  css: string;
}

export interface StateModel {
  header: StateHeader;
  preamble: string;
  direction: StateDirection;
  states: StateNode[];
  transitions: StateTransition[];
  notes: StateNote[];
  /** Pseudo ids added in the editor that have no transition yet (not serialized). */
  pseudo: string[];
  styles: StateStyle[];
  /** Lines kept verbatim: classDef, click, accTitle, accDescr. */
  extra: string[];
}

/** A pseudo state: `[*]` as a start or an end, in a scope. */
export interface Pseudo {
  kind: 'start' | 'end';
  scope: string | null;
}

/** A concurrent region: its composite and its index. */
export interface Region {
  id: string;
  index: number;
}
