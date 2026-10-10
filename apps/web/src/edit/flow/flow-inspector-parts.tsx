import { CATEGORIES, QUICK, SHAPE_BY_ID, SHAPES } from '@nautink/editors/flow/library';
import { cn } from '@nautink/ui/lib/utils';

import { ShapeIcon } from './shape-outline.tsx';
import { InspectorSection } from '../canvas/inspector-card.tsx';
import { SelectField } from '../canvas/inspector-fields.tsx';

import type { SelectOptionGroup } from '../canvas/inspector-fields.tsx';
import type { ReactElement } from 'react';

/** What the shape list shows when the selected nodes have different shapes. */
export const MIXED_SHAPES: string = '';

/** Every shape by category, plus the node's own shape when it is not in the library ("Mixed" for several). */
export function shapeGroups(current: string): SelectOptionGroup[] {
  const groups: SelectOptionGroup[] = CATEGORIES.map((category) => ({
    label: category,
    options: SHAPES.filter((shape) => shape.cat === category).map((shape) => ({
      value: shape.id,
      label: shape.name,
    })),
  }));
  if (SHAPE_BY_ID.has(current)) {
    return groups;
  }
  const label: string = current === MIXED_SHAPES ? 'Mixed' : current;
  return [...groups, { label: 'Other', options: [{ value: current, label }] }];
}

/** The quick shape grid (v1's palette) over the full shape list. */
export function ShapePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (shape: string) => void;
}): ReactElement {
  return (
    <InspectorSection label="Shape">
      <div className="grid grid-cols-5 gap-1">
        {QUICK.map((shape) => (
          <button
            key={shape}
            type="button"
            aria-label={SHAPE_BY_ID.get(shape)?.name ?? shape}
            aria-pressed={shape === value}
            className={cn(
              'grid h-8 place-items-center rounded-control border border-border hover:bg-muted disabled:opacity-50',
              'aria-pressed:border-accent-ink aria-pressed:bg-accent-wash',
            )}
            onClick={() => {
              onChange(shape);
            }}
          >
            <ShapeIcon shape={shape} size={18} />
          </button>
        ))}
      </div>
      <SelectField
        label="All shapes"
        value={value}
        groups={shapeGroups(value)}
        onChange={onChange}
      />
    </InspectorSection>
  );
}

export const DIRECTION_OPTIONS: SelectOptionGroup[] = [
  {
    label: 'Direction',
    options: [
      { value: 'TD', label: 'Top → down' },
      { value: 'LR', label: 'Left → right' },
      { value: 'BT', label: 'Bottom → up' },
      { value: 'RL', label: 'Right → left' },
    ],
  },
];

/** A group's direction: Mermaid writes top-down as `TB` inside a subgraph, or inherits. */
export const GROUP_DIRECTION_OPTIONS: SelectOptionGroup[] = [
  {
    label: 'Direction',
    options: [
      { value: '', label: 'Inherit' },
      { value: 'TB', label: 'Top → down' },
      { value: 'LR', label: 'Left → right' },
      { value: 'BT', label: 'Bottom → up' },
      { value: 'RL', label: 'Right → left' },
    ],
  },
];

/** v1's "How to use" tips. Undo and redo are the top bar's (PRD §3.4). */
export const FLOW_TIPS: readonly string[] = [
  'Drag a shape from the library, or click it',
  'Drag from a node’s edge dot to connect; drop on empty space for a new node',
  'Double-click a node, or press Enter, to rename it',
  'Shift-drag to select many; Shift- or ⌘-click to add to the selection',
  'Delete or Backspace removes, ⌘D duplicates, arrow keys nudge (Shift for 10 px)',
  '⇧1 fits the diagram; ⌘Z and ⌘⇧Z undo and redo',
];
