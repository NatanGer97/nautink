/** What the toolbar adds: a class kind (with its stereotype) or a note (v1's PALETTE). */
export type PaletteKind = 'class' | 'interface' | 'abstract' | 'enumeration' | 'note';

export interface PaletteItem {
  kind: PaletteKind;
  name: string;
  /** New class ids are `<prefix><n>`. */
  prefix: string;
  annotations: readonly string[];
}

export const PALETTE: readonly PaletteItem[] = [
  { kind: 'class', name: 'Class', prefix: 'Class', annotations: [] },
  { kind: 'interface', name: 'Interface', prefix: 'Interface', annotations: ['interface'] },
  { kind: 'abstract', name: 'Abstract', prefix: 'Abstract', annotations: ['abstract'] },
  { kind: 'enumeration', name: 'Enum', prefix: 'Enum', annotations: ['enumeration'] },
  { kind: 'note', name: 'Note', prefix: '', annotations: [] },
];

/** The drag type of a toolbar tile; its data is the palette kind. */
export const CLASS_DRAG_TYPE: string = 'application/x-nautink-class';

export function paletteItem(kind: string): PaletteItem | undefined {
  return PALETTE.find((item) => item.kind === kind);
}
