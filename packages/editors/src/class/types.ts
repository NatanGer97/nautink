// The class editor's model. The model holds plain text; serialize() re-encodes what the grammar
// needs (`"`, `:`).

/** Marker at one end of a relation. `lolli` is a lollipop interface; its end is a free label. */
export type ClassMark = 'none' | 'agg' | 'ext' | 'comp' | 'dep' | 'lolli';
export type ClassLine = 'solid' | 'dashed';
export type ClassDirection = 'TB' | 'BT' | 'LR' | 'RL';
export type ClassHeader = 'classDiagram' | 'classDiagram-v2';

/** An attribute: visibility (`+ - # ~` or ''), text, classifier (`$`, `*` or ''). */
export interface ClassAttr {
  vis: string;
  text: string;
  cls: string;
}

export interface ClassMethod {
  vis: string;
  name: string;
  params: string;
  ret: string;
  cls: string;
}

/** A class. `ns` is the dotted id of its namespace, '' at the top level. */
export interface ClassItem {
  id: string;
  label: string;
  generic: string;
  annotations: string[];
  attrs: ClassAttr[];
  methods: ClassMethod[];
  css: string[];
  ns: string;
}

export interface ClassNamespace {
  id: string;
  label: string;
}

/** A relation from `from` to `to`; `t1`/`m1` belong to the `from` end, `t2`/`m2` to `to`. */
export interface ClassRelation {
  id: string;
  from: string;
  to: string;
  t1: ClassMark;
  t2: ClassMark;
  line: ClassLine;
  label: string;
  m1: string;
  m2: string;
}

/** A note, attached to a class (`for`) or free (''). */
export interface ClassNote {
  id: string;
  text: string;
  for: string;
  ns: string;
}

export interface ClassModel {
  header: ClassHeader;
  direction: ClassDirection;
  isDirExplicit: boolean;
  classes: ClassItem[];
  namespaces: ClassNamespace[];
  relations: ClassRelation[];
  notes: ClassNote[];
  preamble: string;
  extra: string[];
}
