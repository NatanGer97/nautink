import { CATEGORIES, SHAPES } from '@nautink/editors/flow/library';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';

import { iconDragData, SHAPE_DRAG_TYPE } from './flow-drop.ts';
import { ShapeIcon } from './shape-outline.tsx';
import { SelectField } from '../canvas/inspector-fields.tsx';
import { IconLibrary } from '../library/icon-library.tsx';
import { LibraryItem, LibraryPanel, LibrarySearch } from '../library/library-panel.tsx';

import type { NewShape } from './flow-actions.ts';
import type { ShapeCategory, ShapeInfo } from '@nautink/editors/flow/library';
import type { ReactElement } from 'react';

export type FlowLibraryTab = 'shapes' | 'icons';

interface PickProps {
  isReadOnly: boolean;
  onAdd: (spec: NewShape) => void;
}

function matches(shape: ShapeInfo, query: string): boolean {
  return query === '' || shape.name.toLowerCase().includes(query) || shape.id.includes(query);
}

function Category({
  category,
  shapes,
  isOpen,
  onToggle,
  isReadOnly,
  onAdd,
}: PickProps & {
  category: ShapeCategory;
  shapes: readonly ShapeInfo[];
  isOpen: boolean;
  onToggle: () => void;
}): ReactElement {
  return (
    <section aria-label={category}>
      <button
        type="button"
        aria-expanded={isOpen}
        className="flex w-full items-center gap-1 px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground [&_svg]:size-3.5"
        onClick={onToggle}
      >
        {isOpen ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
        {category}
      </button>
      {isOpen ? (
        <div className="grid grid-cols-3 gap-1 px-2 pb-2">
          {shapes.map((shape) => (
            <LibraryItem
              key={shape.id}
              title={`${shape.name} (${shape.id})`}
              caption={shape.name}
              isDisabled={isReadOnly}
              dragType={SHAPE_DRAG_TYPE}
              dragData={shape.id}
              onPick={() => {
                onAdd({ shape: shape.id });
              }}
            >
              <ShapeIcon shape={shape.id} size={24} />
            </LibraryItem>
          ))}
        </div>
      ) : null}
    </section>
  );
}

/** All 53 shapes by category, with search (v1's Library "Shapes" tab). */
function ShapesTab(props: PickProps): ReactElement {
  const [query, setQuery] = useState<string>('');
  const [closed, setClosed] = useState<ReadonlySet<ShapeCategory>>(new Set<ShapeCategory>());
  const needle: string = query.trim().toLowerCase();
  return (
    <>
      <LibrarySearch label="Search shapes" value={query} onChange={setQuery} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {CATEGORIES.map((category) => {
          const shapes: ShapeInfo[] = SHAPES.filter(
            (shape) => shape.cat === category && matches(shape, needle),
          );
          return shapes.length === 0 ? null : (
            <Category
              key={category}
              {...props}
              category={category}
              shapes={shapes}
              isOpen={needle !== '' || !closed.has(category)}
              onToggle={() => {
                const next: Set<ShapeCategory> = new Set<ShapeCategory>(closed);
                if (!next.delete(category)) {
                  next.add(category);
                }
                setClosed(next);
              }}
            />
          );
        })}
      </div>
    </>
  );
}

const FRAME_OPTIONS: { value: string; label: string }[] = [
  { value: 'square', label: 'Square' },
  { value: 'rounded', label: 'Rounded' },
  { value: 'circle', label: 'Circle' },
  { value: '', label: 'No frame' },
];

function IconsTab({ isReadOnly, onAdd }: PickProps): ReactElement {
  const [form, setForm] = useState<string>('square');
  return (
    <IconLibrary
      isReadOnly={isReadOnly}
      onPick={(icon) => {
        onAdd({ icon, form });
      }}
      dragDataOf={(icon) => iconDragData(icon, form)}
    >
      <SelectField
        label="Frame"
        value={form}
        groups={[{ label: 'Frames', options: FRAME_OPTIONS }]}
        onChange={setForm}
      />
    </IconLibrary>
  );
}

export interface FlowLibraryProps extends PickProps {
  tab: FlowLibraryTab;
  onTabChange: (tab: FlowLibraryTab) => void;
  onClose: () => void;
}

/** The flowchart library (M3): Shapes and Icons; click adds at the centre, drag drops in place. */
export function FlowLibrary({
  tab,
  onTabChange,
  onClose,
  ...pick
}: FlowLibraryProps): ReactElement {
  return (
    <LibraryPanel
      activeTab={tab}
      onTabChange={(id) => {
        onTabChange(id === 'icons' ? 'icons' : 'shapes');
      }}
      onClose={onClose}
      tabs={[
        { id: 'shapes', label: 'Shapes', content: <ShapesTab {...pick} /> },
        { id: 'icons', label: 'Icons', content: <IconsTab {...pick} /> },
      ]}
    />
  );
}
