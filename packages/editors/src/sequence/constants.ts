// Participant kinds, block kinds, arrow heads and Mermaid's line type codes.
import type { BlockKind, Central, HeadKind, LineStyle, ParticipantKind } from './types.ts';

export const KINDS: readonly ParticipantKind[] = [
  'participant',
  'actor',
  'boundary',
  'control',
  'entity',
  'database',
  'collections',
  'queue',
];

export const KIND_NAMES: Readonly<Record<ParticipantKind, string>> = {
  participant: 'Participant',
  actor: 'Actor',
  boundary: 'Boundary',
  control: 'Control',
  entity: 'Entity',
  database: 'Database',
  collections: 'Collections',
  queue: 'Queue',
};

/** Block display names, and the keyword of their extra sections (`else`, `and`, `option`). */
export const BLOCKS: Readonly<Record<BlockKind, { name: string; more: string | null }>> = {
  loop: { name: 'Loop', more: null },
  alt: { name: 'Alt', more: 'else' },
  opt: { name: 'Opt', more: null },
  par: { name: 'Par', more: 'and' },
  par_over: { name: 'Par over', more: 'and' },
  critical: { name: 'Critical', more: 'option' },
  break: { name: 'Break', more: null },
  rect: { name: 'Rect', more: null },
};

/** An arrow head; `isReversed` heads sit at the source end of the line. */
export interface HeadInfo {
  name: string;
  token: (dashes: string) => string;
  isReversed?: boolean;
}

export const HEADS: Readonly<Record<HeadKind, HeadInfo>> = {
  arrow: { name: 'Arrow', token: (dashes: string): string => `${dashes}>>` },
  open: { name: 'Open (no head)', token: (dashes: string): string => `${dashes}>` },
  cross: { name: 'Cross', token: (dashes: string): string => `${dashes}x` },
  async: { name: 'Async', token: (dashes: string): string => `${dashes})` },
  bi: { name: 'Both ends', token: (dashes: string): string => `<<${dashes}>>` },
  halfTop: { name: 'Half arrow, top', token: (dashes: string): string => `${dashes}|\\` },
  halfBottom: { name: 'Half arrow, bottom', token: (dashes: string): string => `${dashes}|/` },
  stickTop: { name: 'Stick, top', token: (dashes: string): string => `${dashes}\\\\` },
  stickBottom: { name: 'Stick, bottom', token: (dashes: string): string => `${dashes}//` },
  halfTopRev: {
    name: 'Half arrow, top, reverse',
    token: (dashes: string): string => `/|${dashes}`,
    isReversed: true,
  },
  halfBottomRev: {
    name: 'Half arrow, bottom, reverse',
    token: (dashes: string): string => `\\|${dashes}`,
    isReversed: true,
  },
  stickTopRev: {
    name: 'Stick, top, reverse',
    token: (dashes: string): string => `//${dashes}`,
    isReversed: true,
  },
  stickBottomRev: {
    name: 'Stick, bottom, reverse',
    token: (dashes: string): string => `\\\\${dashes}`,
    isReversed: true,
  },
};

// Codes are Mermaid's LINETYPE numbers, keyed as strings: look them up with `String(code)`.

/** Mermaid LINETYPE code -> line style and head. */
export const LINE_TYPES: ReadonlyMap<string, readonly [LineStyle, HeadKind]> = new Map<
  string,
  readonly [LineStyle, HeadKind]
>(
  Object.entries({
    0: ['solid', 'arrow'] as const,
    1: ['dotted', 'arrow'] as const,
    3: ['solid', 'cross'] as const,
    4: ['dotted', 'cross'] as const,
    5: ['solid', 'open'] as const,
    6: ['dotted', 'open'] as const,
    24: ['solid', 'async'] as const,
    25: ['dotted', 'async'] as const,
    33: ['solid', 'bi'] as const,
    34: ['dotted', 'bi'] as const,
    41: ['solid', 'halfTop'] as const,
    42: ['solid', 'halfBottom'] as const,
    43: ['solid', 'stickTop'] as const,
    44: ['solid', 'stickBottom'] as const,
    45: ['solid', 'halfTopRev'] as const,
    46: ['solid', 'halfBottomRev'] as const,
    47: ['solid', 'stickTopRev'] as const,
    48: ['solid', 'stickBottomRev'] as const,
    51: ['dotted', 'halfTop'] as const,
    52: ['dotted', 'halfBottom'] as const,
    53: ['dotted', 'stickTop'] as const,
    54: ['dotted', 'stickBottom'] as const,
    55: ['dotted', 'halfTopRev'] as const,
    56: ['dotted', 'halfBottomRev'] as const,
    57: ['dotted', 'stickTopRev'] as const,
    58: ['dotted', 'stickBottomRev'] as const,
  }),
);

export const BLOCK_START: ReadonlyMap<string, BlockKind> = new Map<string, BlockKind>(
  Object.entries({
    10: 'loop' as const,
    12: 'alt' as const,
    15: 'opt' as const,
    19: 'par' as const,
    32: 'par_over' as const,
    22: 'rect' as const,
    27: 'critical' as const,
    30: 'break' as const,
  }),
);

/** `else`, `and`, `option`. */
export const BLOCK_MORE: ReadonlySet<string> = new Set<string>(['13', '20', '28']);
export const BLOCK_END: ReadonlySet<string> = new Set<string>([
  '11',
  '14',
  '16',
  '21',
  '23',
  '29',
  '31',
]);
export const CENTRAL: ReadonlyMap<string, Central> = new Map<string, Central>(
  Object.entries({
    59: 'to' as const,
    60: 'from' as const,
    61: 'both' as const,
  }),
);
