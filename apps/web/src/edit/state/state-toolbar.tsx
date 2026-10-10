import { PaletteIcon } from './palette-icon.tsx';
import { STATE_DRAG_TYPE } from './state-types.ts';
import {
  EditorToolbar,
  ToolbarHelp,
  ToolbarIconButton,
  ToolbarSelect,
  ToolbarSeparator,
  ToolbarTextButton,
} from '../canvas/editor-toolbar.tsx';

import type { PaletteKind } from './state-types.ts';
import type { StateDirection } from '@nautink/editors/state/types';
import type { ReactElement } from 'react';

/** The toolbar's items, in v1's order (`PALETTE`). */
export const PALETTE_TOOLS: readonly { kind: PaletteKind; label: string }[] = [
  { kind: 'state', label: 'Add state' },
  { kind: 'start', label: 'Add start [*]' },
  { kind: 'end', label: 'Add end [*]' },
  { kind: 'choice', label: 'Add choice' },
  { kind: 'fork', label: 'Add fork' },
  { kind: 'join', label: 'Add join' },
  { kind: 'composite', label: 'Add composite state' },
  { kind: 'note', label: 'Add note' },
];

export const DIRECTION_OPTIONS: readonly { value: Exclude<StateDirection, ''>; label: string }[] = [
  { value: 'TB', label: 'Top → down' },
  { value: 'LR', label: 'Left → right' },
  { value: 'BT', label: 'Bottom → up' },
  { value: 'RL', label: 'Right → left' },
];

/** v1's "How to use" tips. Undo and redo are the top bar's (PRD §3.4). */
export const STATE_TIPS: readonly string[] = [
  'Drag an item from the toolbar, or click it; drop it inside a composite to nest it',
  'Drag from a state’s edge dot to another state to add a transition; drop on empty space for a new state',
  'Double-click a state, a composite’s title or a note, or press Enter, to rename or edit it',
  'Double-click a transition to edit its label',
  'Shift-drag to select many, then wrap them in a composite',
  'Delete or Backspace removes, arrow keys nudge (Shift for 10 px)',
  '⇧1 fits the diagram; ⌘Z and ⌘⇧Z undo and redo',
];

export interface StateToolbarProps {
  isReadOnly: boolean;
  onAdd: (kind: PaletteKind) => void;
  onAutoLayout: () => void;
  /** The diagram's direction; null while there is no model yet. */
  direction: StateDirection | null;
  onDirection: (direction: StateDirection) => void;
}

function isDirection(value: string): value is StateDirection {
  return DIRECTION_OPTIONS.some((option) => option.value === value);
}

/**
 * The canvas toolbar (M1): every state item (click, or drag onto the canvas), auto layout and the
 * direction. No undo or redo here: those live in the top bar (PRD §3.4).
 */
export function StateToolbar({
  isReadOnly,
  onAdd,
  onAutoLayout,
  direction,
  onDirection,
}: StateToolbarProps): ReactElement {
  return (
    <EditorToolbar>
      {PALETTE_TOOLS.map((tool) => (
        <ToolbarIconButton
          key={tool.kind}
          label={tool.label}
          icon={<PaletteIcon kind={tool.kind} />}
          isDisabled={isReadOnly}
          onClick={() => {
            onAdd(tool.kind);
          }}
          onDragStart={(event) => {
            event.dataTransfer.setData(STATE_DRAG_TYPE, tool.kind);
          }}
        />
      ))}
      <ToolbarSeparator />
      <ToolbarTextButton isDisabled={direction === null} onClick={onAutoLayout}>
        Auto layout
      </ToolbarTextButton>
      <ToolbarSeparator />
      <ToolbarSelect
        label="Direction"
        value={direction === null || direction === '' ? 'TB' : direction}
        options={DIRECTION_OPTIONS}
        isDisabled={isReadOnly || direction === null}
        onChange={(value) => {
          if (isDirection(value)) {
            onDirection(value);
          }
        }}
      />
      <ToolbarHelp tips={STATE_TIPS} />
    </EditorToolbar>
  );
}
