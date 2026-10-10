import { IconButton } from '@nautink/ui/icon-button';
import { cn } from '@nautink/ui/lib/utils';
import { X } from 'lucide-react';
import { useId } from 'react';

import type { ReactElement, ReactNode } from 'react';

export interface LibraryTab {
  id: string;
  label: string;
  content: ReactNode;
}

export interface LibraryPanelProps {
  tabs: readonly LibraryTab[];
  activeTab: string;
  onTabChange: (id: string) => void;
  onClose: () => void;
}

/**
 * The floating library under the canvas toolbar (M1, M3): tabs of things to drag or click onto the
 * canvas. An editor passes its own tabs (the flowchart's Shapes and Icons).
 */
export function LibraryPanel({
  tabs,
  activeTab,
  onTabChange,
  onClose,
}: LibraryPanelProps): ReactElement {
  const baseId: string = useId();
  const active: LibraryTab | undefined = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];
  return (
    <section
      aria-label="Library"
      data-canvas-chrome=""
      className="absolute top-[68px] bottom-4 left-4 z-10 flex w-[264px] flex-col overflow-hidden rounded-float border bg-panel shadow-float"
    >
      <div className="flex items-center gap-1 border-b border-border-subtle p-1.5">
        <div role="tablist" aria-label="Library" className="flex flex-1 gap-0.5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`${baseId}-${tab.id}`}
              aria-selected={tab.id === active?.id}
              aria-controls={`${baseId}-panel`}
              className={cn(
                'h-7 rounded-control px-2.5 font-medium text-muted-foreground hover:text-foreground',
                'aria-selected:bg-muted aria-selected:text-foreground',
              )}
              onClick={() => {
                onTabChange(tab.id);
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <IconButton label="Close library" icon={<X />} className="size-7" onClick={onClose} />
      </div>
      <div
        role="tabpanel"
        id={`${baseId}-panel`}
        aria-labelledby={active === undefined ? undefined : `${baseId}-${active.id}`}
        className="flex min-h-0 flex-1 flex-col"
      >
        {active?.content}
      </div>
    </section>
  );
}

/** The library's search box. */
export function LibrarySearch({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}): ReactElement {
  return (
    <input
      type="search"
      aria-label={label}
      placeholder={label}
      value={value}
      className="m-2 h-8 rounded-control border bg-subtle px-2.5 outline-none placeholder:text-faint focus-visible:border-ring"
      onChange={(event) => {
        onChange(event.target.value);
      }}
    />
  );
}

export interface LibraryItemProps {
  /** The accessible name and tooltip ("Decision (diam)"). */
  title: string;
  caption: string;
  isDisabled: boolean;
  dragType: string;
  dragData: string;
  onPick: () => void;
  children: ReactNode;
}

/** One library tile: click adds it at the canvas centre, drag drops it where you let go. */
export function LibraryItem({
  title,
  caption,
  isDisabled,
  dragType,
  dragData,
  onPick,
  children,
}: LibraryItemProps): ReactElement {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={isDisabled}
      draggable={!isDisabled}
      className="flex h-16 min-w-0 flex-col items-center justify-center gap-1 rounded-control border border-transparent px-1 text-2xs text-muted-foreground hover:border-border hover:bg-subtle hover:text-foreground disabled:opacity-50"
      onDragStart={(event) => {
        event.dataTransfer.setData(dragType, dragData);
      }}
      onClick={(event) => {
        event.currentTarget.blur();
        onPick();
      }}
    >
      {children}
      <span className="w-full truncate text-center">{caption}</span>
    </button>
  );
}
