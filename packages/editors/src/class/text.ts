// Text helpers for the class editor: entity handling, generics, member text and ids.
import type { ClassAttr, ClassMethod } from './types.ts';

export const VISIBILITY: readonly string[] = ['+', '-', '#', '~'];

const NAMED: ReadonlyMap<string, string> = new Map(
  Object.entries({ quot: '"', colon: ':', amp: '&', lt: '<', gt: '>', semi: ';', apos: "'" }),
);
const ENTITY_DELIMITERS: number = 1;

function entityName(entity: string): string {
  return entity.slice(ENTITY_DELIMITERS, -ENTITY_DELIMITERS);
}

/** Source text to what a human reads: `#9829;` → ♥, `#quot;` → ". */
export function readable(text: string): string {
  return text
    .replace(/#\d+;/g, (entity: string) => String.fromCodePoint(Number(entityName(entity))))
    .replace(/#\w+;/g, (entity: string) => NAMED.get(entityName(entity)) ?? entity);
}

/** A note's display lines (`\n`, `<br>` and newlines all break). */
export function noteLines(text: string): string[] {
  return readable(text).split(/\\n|<br\s*\/?>|\n/i);
}

/** Free text to safe text inside a "..." string. */
export function quoteSafe(text: string): string {
  return text.replace(/"/g, '#quot;');
}

/** Inspector note text to note source text: quotes encoded, newlines as `\n`. */
export function noteFromEditor(text: string): string {
  return quoteSafe(text).split('\n').join('\\n');
}

function genericBracket(text: string, index: number): string {
  const next: string | undefined = text[index + 1];
  const isClose: boolean = next === undefined || /[~\s,)\]>:;]/.test(next) || index === 0;
  return isClose ? '>' : '<';
}

function count(text: string, char: string): number {
  return text.split(char).length - 1;
}

/** Mermaid generics: `List~List~int~~` → `List<List<int>>`. Unbalanced results keep the source. */
export function generics(text: string): string {
  const out: string = text
    .split('')
    .map((char: string, index: number) => (char === '~' ? genericBracket(text, index) : char))
    .join('');
  return count(out, '<') === count(out, '>') ? out : text;
}

/** A class id as source: plain when the grammar allows, else in backticks. */
export function idSource(id: string): string {
  return /^[\p{L}\p{N}_][\p{L}\p{N}_-]*$/u.test(id) ? id : `\`${id.replace(/`/g, '')}\``;
}

/** One line of attribute text to an attribute (mirrors Mermaid's ClassMember parsing). */
export function attrFromText(raw: string): ClassAttr {
  let text: string = raw.replace(/[\r\n]+/g, ' ').trim();
  const vis: string = VISIBILITY.includes(text.charAt(0)) ? text.charAt(0) : '';
  text = text.slice(vis.length);
  const cls: string = /[$*]$/.test(text) ? text.slice(-1) : '';
  text = cls ? text.slice(0, -1) : text;
  return { vis, text: text.trim(), cls };
}

const METHOD_RE: RegExp = /^([#+~-])?(.+?)\((.*)\)([\s$*])?(.*)$/;

/** One line of method text to a method, or null when it has no `(...)`. */
export function methodFromText(raw: string): ClassMethod | null {
  const match: RegExpExecArray | null = METHOD_RE.exec(raw.replace(/[\r\n]+/g, ' ').trim());
  if (match === null) {
    return null;
  }
  const [, vis = '', name = '', params = '', classifier = '', rest = ''] = match;
  const ret: string = rest.trim();
  const hasTrailingClassifier: boolean = !classifier.trim() && /[$*]$/.test(ret);
  return {
    vis,
    name: name.trim(),
    params: params.trim(),
    ret: hasTrailingClassifier ? ret.slice(0, -1).trim() : ret,
    cls: hasTrailingClassifier ? ret.slice(-1) : classifier.trim(),
  };
}

export function attrSource(attr: ClassAttr): string {
  return `${attr.vis}${attr.text}${attr.cls}`;
}

export function methodSource(method: ClassMethod): string {
  return `${method.vis}${method.name}(${method.params})${method.cls}${method.ret ? ` ${method.ret}` : ''}`;
}

/** What the canvas shows for an attribute (without the visibility symbol). */
export function attrDisplay(attr: ClassAttr): string {
  return generics(readable(attr.text));
}

/** What the canvas shows for a method (without the visibility symbol). */
export function methodDisplay(method: ClassMethod): string {
  const ret: string = method.ret ? ` : ${generics(readable(method.ret))}` : '';
  return `${generics(readable(method.name))}(${generics(readable(method.params))})${ret}`;
}

/** Parent of a dotted namespace id ('' at the top). */
export function nsParent(id: string): string {
  return id.includes('.') ? id.slice(0, id.lastIndexOf('.')) : '';
}

/** Last segment of a dotted namespace id. */
export function nsLeaf(id: string): string {
  return id.slice(id.lastIndexOf('.') + 1);
}
