import { cn } from '@nautink/ui/lib/utils';

import { useDebouncedValue } from './use-debounced-value.ts';
import { clockTime, fullTime, KIND_BADGE_CLASSES, KIND_LABELS } from './version-text.ts';
import { DiagramThumbnail } from '../mermaid/diagram-thumbnail.tsx';

import type { VersionKind } from '@nautink/storage/records';
import type { ReactElement } from 'react';

/** The current code's thumbnail waits for typing to pause, so keystrokes do not queue renders. */
const CURRENT_THUMBNAIL_DELAY_MS: number = 800;

/** The DOM id of a row, for `aria-activedescendant`. */
export function versionRowId(id: string): string {
  return `version-row-${id}`;
}

export interface VersionRowProps {
  id: string;
  kind: VersionKind | 'current';
  code: string;
  /** `null` for the current code ("now"). */
  createdAt: number | null;
  text: string;
  isSelected: boolean;
  onSelect: () => void;
}

/** One version: thumbnail, kind badge, time, and its name or Claude's prompt (M5). */
export function VersionRow(props: VersionRowProps): ReactElement {
  const { id, kind, createdAt, text, isSelected } = props;
  const code: string = useDebouncedValue(props.code, CURRENT_THUMBNAIL_DELAY_MS);
  const time: string = createdAt === null ? 'now' : clockTime(createdAt);
  return (
    // The list owns the keyboard (aria-activedescendant listbox), so a row only needs the pointer.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events
    <div
      id={versionRowId(id)}
      role="option"
      tabIndex={-1}
      aria-selected={isSelected}
      aria-label={`${KIND_LABELS[kind]}, ${time}, ${text}`}
      className="flex cursor-pointer items-center gap-2.5 rounded-track p-2 outline-none hover:bg-muted/60 aria-selected:bg-muted aria-selected:shadow-[inset_0_0_0_1px_var(--border-strong)] group-focus-within/list:aria-selected:ring-2 group-focus-within/list:aria-selected:ring-ring/60"
      onClick={props.onSelect}
    >
      <DiagramThumbnail code={kind === 'current' ? code : props.code} className="h-10 w-[54px]" />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-center gap-1.5">
          <span className={cn('rounded-xs px-1.5 text-2xs font-medium', KIND_BADGE_CLASSES[kind])}>
            {KIND_LABELS[kind]}
          </span>
          <span
            className="text-xs text-faint"
            title={createdAt === null ? undefined : fullTime(createdAt)}
          >
            {time}
          </span>
        </span>
        <span className="truncate">{text}</span>
      </span>
    </div>
  );
}
