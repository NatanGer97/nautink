// Reads `style`, `classDef`, `cssClass` and `:::` from the model so the canvas can tint classes
// like Mermaid does. Only colors and stroke width are applied.
import type { ClassItem, ClassModel } from './types.ts';

/** CSS declarations for one class box (custom properties and style keys). */
export type ClassStyle = Record<string, string>;

type Props = Record<string, string>;

const DARK_TEXT: string = '#1c1f24';
const LIGHT_TEXT: string = '#f2f3f5';
const LIGHT_BACKGROUND: number = 0.55;
const HEX_RADIX: number = 16;
const CHANNEL_MAX: number = 255;
const RED_WEIGHT: number = 0.2126;
const GREEN_WEIGHT: number = 0.7152;
const BLUE_WEIGHT: number = 0.0722;
const CHANNEL_STARTS: Readonly<Record<'red' | 'green' | 'blue', number>> = {
  red: 0,
  green: 2,
  blue: 4,
};
const CHANNEL_WIDTH: number = 2;
const SHORT_HEX: number = 3;

function props(list: string): Props {
  const out: Props = {};
  for (const part of list.split(',')) {
    const [key = '', ...value] = part.split(':');
    const name: string = key.trim();
    const text: string = value.join(':').trim().replace(/;$/, '');
    if (name && text) {
      out[name] = text;
    }
  }
  return out;
}

/** Relative luminance of a hex color, or null when it is not a 3- or 6-digit hex color. */
export function luminance(color: string): number | null {
  const hex: string = color.replace('#', '');
  const full: string = hex.length === SHORT_HEX ? hex.replace(/./g, '$&$&') : hex;
  if (!/^[0-9a-f]{6}$/i.test(full)) {
    return null;
  }
  const channel = (start: number): number =>
    parseInt(full.slice(start, start + CHANNEL_WIDTH), HEX_RADIX) / CHANNEL_MAX;
  return (
    RED_WEIGHT * channel(CHANNEL_STARTS.red) +
    GREEN_WEIGHT * channel(CHANNEL_STARTS.green) +
    BLUE_WEIGHT * channel(CHANNEL_STARTS.blue)
  );
}

interface StyleSources {
  defs: Map<string, Props>;
  byId: Map<string, Props>;
  cssOf: Map<string, string[]>;
}

function merge(map: Map<string, Props>, key: string, more: Props): void {
  map.set(key, { ...map.get(key), ...more });
}

function readClassDef(sources: StyleSources, line: string): void {
  const match: RegExpExecArray | null = /^classDef\s+(\S+)\s+(.+)$/.exec(line);
  if (match?.[1] === undefined) {
    return;
  }
  for (const name of match[1].split(',')) {
    merge(sources.defs, name, props(match[2] ?? ''));
  }
}

function readStyle(sources: StyleSources, line: string): void {
  const match: RegExpExecArray | null = /^style\s+(\S+)\s+(.+)$/.exec(line);
  if (match?.[1] !== undefined) {
    merge(sources.byId, match[1], props(match[2] ?? ''));
  }
}

function readCssClass(sources: StyleSources, line: string): void {
  const match: RegExpExecArray | null = /^cssClass\s+"([^"]+)"\s+(\S+)/.exec(line);
  if (match?.[1] === undefined) {
    return;
  }
  for (const id of match[1].split(',')) {
    sources.cssOf.get(id.trim())?.push(match[2] ?? '');
  }
}

function readSources(model: ClassModel): StyleSources {
  const sources: StyleSources = {
    defs: new Map<string, Props>(),
    byId: new Map<string, Props>(),
    cssOf: new Map<string, string[]>(
      model.classes.map((item: ClassItem) => [item.id, [...item.css]]),
    ),
  };
  for (const line of model.extra) {
    readClassDef(sources, line);
    readStyle(sources, line);
    readCssClass(sources, line);
  }
  return sources;
}

function colorStyle(color: Props): ClassStyle {
  const style: ClassStyle = {};
  if (color.fill) {
    style['--node-fill'] = color.fill;
    style['--cls-head'] = color.fill;
    const light: number | null = luminance(color.fill);
    if (light !== null && !color.color) {
      style.color = light > LIGHT_BACKGROUND ? DARK_TEXT : LIGHT_TEXT;
    }
  }
  return style;
}

function styleOf(color: Props): ClassStyle {
  const style: ClassStyle = colorStyle(color);
  const entries: [string, string | undefined][] = [
    ['--node-stroke', color.stroke],
    ['color', color.color],
    ['borderWidth', color['stroke-width']],
    ['borderStyle', color['stroke-dasharray'] ? 'dashed' : undefined],
  ];
  for (const [key, value] of entries) {
    if (value) {
      style[key] = value;
    }
  }
  return style;
}

function colorOf(sources: StyleSources, id: string): Props {
  const layers: Props[] = [
    sources.defs.get('default') ?? {},
    ...(sources.cssOf.get(id) ?? []).map((name: string) => sources.defs.get(name) ?? {}),
    sources.byId.get(id) ?? {},
  ];
  return layers.reduce((merged: Props, layer: Props) => ({ ...merged, ...layer }), {});
}

/** The style of every class that has one, keyed by class id. */
export function classStyles(model: ClassModel): Record<string, ClassStyle> {
  const sources: StyleSources = readSources(model);
  const out: Record<string, ClassStyle> = {};
  for (const item of model.classes) {
    const color: Props = colorOf(sources, item.id);
    if (Object.keys(color).length > 0) {
      out[item.id] = styleOf(color);
    }
  }
  return out;
}
