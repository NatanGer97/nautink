import { DIRECTIONS } from '@nautink/editors/er/model';
import { Table2 } from 'lucide-react';

import { ENTITY_DRAG_TYPE } from './er-handlers.ts';
import {
  EditorToolbar,
  ToolbarHelp,
  ToolbarIconButton,
  ToolbarSelect,
  ToolbarSeparator,
  ToolbarTextButton,
} from '../canvas/editor-toolbar.tsx';

import type { ErDirection } from '@nautink/editors/er/model';
import type { ReactElement } from 'react';

export interface ErToolbarProps {
  isReadOnly: boolean;
  hasModel: boolean;
  onAddEntity: () => void;
  onAutoLayout: () => void;
  /** The diagram's direction; null while there is no model yet. */
  direction: ErDirection | null;
  onDirection: (direction: ErDirection) => void;
}

const DIRECTION_OPTIONS: readonly { value: ErDirection; label: string }[] = [
  { value: 'TB', label: 'Top → down' },
  { value: 'LR', label: 'Left → right' },
  { value: 'BT', label: 'Bottom → up' },
  { value: 'RL', label: 'Right → left' },
];

/** v1's "How to use" tips. Undo and redo are the top bar's (PRD §3.4). */
export const ER_TIPS: readonly string[] = [
  'Click Add entity, or drag it onto the canvas',
  'Drag from an entity’s edge dot to another entity to relate them; drop on empty space for a new entity',
  'Double-click a table header or a link label, or press Enter, to rename it',
  'Select an entity to edit its attributes and keys',
  'Delete or Backspace removes, arrow keys nudge (Shift for 10 px)',
  '⇧1 fits the diagram; ⌘Z and ⌘⇧Z undo and redo',
];

function isDirection(value: string): value is ErDirection {
  return DIRECTIONS.some((direction) => direction === value);
}

/** The canvas toolbar (M1): add an entity (click or drag), auto layout, direction and tips. */
export function ErToolbar({
  isReadOnly,
  hasModel,
  onAddEntity,
  onAutoLayout,
  direction,
  onDirection,
}: ErToolbarProps): ReactElement {
  return (
    <EditorToolbar>
      <ToolbarIconButton
        label="Add entity"
        icon={<Table2 />}
        isDisabled={isReadOnly}
        onClick={onAddEntity}
        onDragStart={(event) => {
          event.dataTransfer.setData(ENTITY_DRAG_TYPE, 'entity');
        }}
      />
      <ToolbarSeparator />
      <ToolbarTextButton isDisabled={!hasModel} onClick={onAutoLayout}>
        Auto layout
      </ToolbarTextButton>
      <ToolbarSeparator />
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
      <ToolbarHelp tips={ER_TIPS} />
    </EditorToolbar>
  );
}
