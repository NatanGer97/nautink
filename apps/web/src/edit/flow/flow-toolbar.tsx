import { Shapes, Square } from 'lucide-react';

import { SHAPE_DRAG_TYPE } from './flow-drop.ts';
import { DIRECTION_OPTIONS, FLOW_TIPS } from './flow-inspector-parts.tsx';
import {
  EditorToolbar,
  ToolbarHelp,
  ToolbarIconButton,
  ToolbarSelect,
  ToolbarSeparator,
  ToolbarTextButton,
} from '../canvas/editor-toolbar.tsx';

import type { NewShape } from './flow-actions.ts';
import type { FlowLibraryTab } from './flow-library.tsx';
import type { FlowDirection } from '@nautink/editors/flow/model';
import type { ReactElement } from 'react';

export interface FlowToolbarProps {
  isReadOnly: boolean;
  hasGraph: boolean;
  libraryTab: FlowLibraryTab | null;
  onAdd: (spec: NewShape) => void;
  onLibrary: (tab: FlowLibraryTab | null) => void;
  onAutoLayout: () => void;
  /** The diagram's direction; null while there is no model yet. */
  direction: FlowDirection | null;
  onDirection: (direction: FlowDirection) => void;
}

function isDirection(value: string): value is FlowDirection {
  return ['TD', 'LR', 'BT', 'RL'].includes(value);
}

/**
 * The canvas toolbar (M1): add a shape (click, or drag onto the canvas), add an icon, the library,
 * and auto layout. No undo or redo here: those live in the top bar (PRD §3.4).
 */
export function FlowToolbar({
  isReadOnly,
  hasGraph,
  libraryTab,
  onAdd,
  onLibrary,
  onAutoLayout,
  direction,
  onDirection,
}: FlowToolbarProps): ReactElement {
  return (
    <EditorToolbar>
      <ToolbarIconButton
        label="Add shape"
        icon={<Square />}
        isDisabled={isReadOnly}
        onClick={() => {
          onAdd({ shape: 'rect' });
        }}
        onDragStart={(event) => {
          event.dataTransfer.setData(SHAPE_DRAG_TYPE, 'rect');
        }}
      />
      <ToolbarIconButton
        label="Add icon"
        icon={<Shapes />}
        isDisabled={isReadOnly}
        isActive={libraryTab === 'icons'}
        onClick={() => {
          onLibrary(libraryTab === 'icons' ? null : 'icons');
        }}
      />
      <ToolbarSeparator />
      <ToolbarTextButton
        isPressed={libraryTab !== null}
        onClick={() => {
          onLibrary(libraryTab === null ? 'shapes' : null);
        }}
      >
        Library
      </ToolbarTextButton>
      <ToolbarTextButton isDisabled={!hasGraph} onClick={onAutoLayout}>
        Auto layout
      </ToolbarTextButton>
      <ToolbarSeparator />
      <ToolbarSelect
        label="Direction"
        value={direction ?? 'TD'}
        options={DIRECTION_OPTIONS[0]?.options ?? []}
        isDisabled={isReadOnly || direction === null}
        onChange={(value) => {
          if (isDirection(value)) {
            onDirection(value);
          }
        }}
      />
      <ToolbarHelp tips={FLOW_TIPS} />
    </EditorToolbar>
  );
}
