import { ASSOCIATION, KINDS } from '@nautink/editors/class/model';

import { KindIcon, PaletteIcon } from './class-icons.tsx';
import { CLASS_DRAG_TYPE, PALETTE } from './class-palette.ts';
import {
  EditorToolbar,
  ToolbarHelp,
  ToolbarIconButton,
  ToolbarSelect,
  ToolbarSeparator,
  ToolbarTextButton,
} from '../canvas/editor-toolbar.tsx';

import type { PaletteKind } from './class-palette.ts';
import type { RelationKind } from '@nautink/editors/class/model';
import type { ClassDirection } from '@nautink/editors/class/types';
import type { ReactElement } from 'react';

export const DIRECTION_OPTIONS: readonly { value: ClassDirection; label: string }[] = [
  { value: 'TB', label: 'Top → down' },
  { value: 'LR', label: 'Left → right' },
  { value: 'BT', label: 'Bottom → up' },
  { value: 'RL', label: 'Right → left' },
];

const KIND_OPTIONS: readonly { value: string; label: string }[] = KINDS.map((kind) => ({
  value: kind.id,
  label: `${kind.name}  ${kind.op}`,
}));

/** v1's "How to use" tips. Undo and redo are the top bar's (PRD §3.4). */
export const CLASS_TIPS: readonly string[] = [
  'Drag a class or note from the toolbar onto the canvas, or click it',
  'Pick a relation kind in the toolbar, then drag from a class’s edge dot to another class; drop on empty space for a new class',
  'Inheritance: drag from the subclass to the parent. Composition: from the whole to the part',
  'Double-click a class name or a member to edit it in place, or press Enter to rename',
  'Delete or Backspace removes, ⌘D duplicates, arrow keys nudge (Shift for 10 px)',
  '⇧1 fits the diagram; ⌘Z and ⌘⇧Z undo and redo',
];

export interface ClassToolbarProps {
  isReadOnly: boolean;
  hasModel: boolean;
  onAdd: (kind: PaletteKind) => void;
  relationKind: string;
  onRelationKind: (kind: string) => void;
  onAutoLayout: () => void;
  /** The diagram's direction; null while there is no model yet. */
  direction: ClassDirection | null;
  onDirection: (direction: ClassDirection) => void;
}

function PaletteTools({
  isReadOnly,
  onAdd,
}: Pick<ClassToolbarProps, 'isReadOnly' | 'onAdd'>): ReactElement {
  return (
    <>
      {PALETTE.map((item) => (
        <ToolbarIconButton
          key={item.kind}
          label={`Add ${item.name.toLowerCase()}`}
          icon={<PaletteIcon kind={item.kind} />}
          isDisabled={isReadOnly}
          onClick={() => {
            onAdd(item.kind);
          }}
          onDragStart={(event) => {
            event.dataTransfer.setData(CLASS_DRAG_TYPE, item.kind);
          }}
        />
      ))}
    </>
  );
}

function RelationKindPicker({
  isReadOnly,
  relationKind,
  onRelationKind,
}: Pick<ClassToolbarProps, 'isReadOnly' | 'relationKind' | 'onRelationKind'>): ReactElement {
  const kind: RelationKind = KINDS.find((item) => item.id === relationKind) ?? ASSOCIATION;
  return (
    <div className="flex items-center pl-1">
      <KindIcon kind={kind} />
      <ToolbarSelect
        label="Relation kind for new links"
        value={kind.id}
        options={KIND_OPTIONS}
        isDisabled={isReadOnly}
        onChange={onRelationKind}
      />
    </div>
  );
}

function isDirection(value: string): value is ClassDirection {
  return DIRECTION_OPTIONS.some((option) => option.value === value);
}

/**
 * The canvas toolbar (M1): add a class, interface, abstract class, enum or note (click, or drag
 * onto the canvas), the kind for new links, auto layout and direction. No undo or redo here: those
 * live in the top bar (PRD §3.4).
 */
export function ClassToolbar(props: ClassToolbarProps): ReactElement {
  const { isReadOnly, direction, onDirection } = props;
  return (
    <EditorToolbar>
      <PaletteTools isReadOnly={isReadOnly} onAdd={props.onAdd} />
      <ToolbarSeparator />
      <RelationKindPicker
        isReadOnly={isReadOnly}
        relationKind={props.relationKind}
        onRelationKind={props.onRelationKind}
      />
      <ToolbarSeparator />
      <ToolbarTextButton isDisabled={!props.hasModel} onClick={props.onAutoLayout}>
        Auto layout
      </ToolbarTextButton>
      <ToolbarSelect
        label="Direction"
        value={direction ?? 'TB'}
        options={DIRECTION_OPTIONS}
        isDisabled={isReadOnly || direction === null}
        onChange={(value) => {
          if (isDirection(value)) {
            onDirection(value);
          }
        }}
      />
      <ToolbarHelp tips={CLASS_TIPS} />
    </EditorToolbar>
  );
}
