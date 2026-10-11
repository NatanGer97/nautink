import { typeName } from '@nautink/storage/diagram-type';
import { Pin } from 'lucide-react';

import { DiagramRowMenu } from './diagram-row-menu.tsx';
import { MatchSnippet } from './match-snippet.tsx';
import { relativeTime } from '../relative-time.ts';
import { displayTitle } from '../text.ts';
import { InlineRenameInput } from '../title/inline-rename-input.tsx';

import type { SearchHit } from '@nautink/storage/search';
import type { MouseEvent, ReactElement } from 'react';

/** The DOM id of a row, for `aria-activedescendant`. */
export function rowDomId(id: string): string {
  return `diagram-row-${id}`;
}

export interface DiagramRowProps {
  hit: SearchHit;
  now: number;
  isActive: boolean;
  isCursor: boolean;
  isRenaming: boolean;
  isMenuOpen: boolean;
  onOpen: () => void;
  onStartRename: () => void;
  onRename: (title: string) => void;
  onEndRename: () => void;
  onMenuOpenChange: (isOpen: boolean) => void;
  onMenuClosed: () => void;
}

function rowLabel(hit: SearchHit, now: number): string {
  const { diagram } = hit;
  const parts: string[] = [
    displayTitle(diagram.title),
    typeName(diagram.code),
    relativeTime(diagram.updatedAt, now),
  ];
  return [...parts, ...(diagram.pinned ? ['pinned'] : [])].join(', ');
}

/** One diagram in the list: title, type badge, relative time, pin, search snippet and ⋯ menu. */
export function DiagramRow(props: DiagramRowProps): ReactElement {
  const { hit, now, isActive, isCursor, isRenaming } = props;
  const { diagram } = hit;
  const title: string = displayTitle(diagram.title);
  return (
    // The list owns the keyboard (aria-activedescendant listbox): arrows, Enter and F2 are handled
    // on it, so the row itself only needs the pointer handlers.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events
    <div
      id={rowDomId(diagram.id)}
      role="option"
      tabIndex={-1}
      aria-selected={isActive}
      aria-label={rowLabel(hit, now)}
      data-cursor={isCursor}
      className="group/row flex cursor-pointer items-center gap-2 rounded-track p-2 outline-none hover:bg-muted/60 aria-selected:bg-muted group-focus-within/list:data-[cursor=true]:ring-2 group-focus-within/list:data-[cursor=true]:ring-ring/60"
      onClick={props.onOpen}
      onDoubleClick={props.onStartRename}
      onContextMenu={(event: MouseEvent) => {
        event.preventDefault();
        props.onMenuOpenChange(true);
      }}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
        {isRenaming ? (
          <InlineRenameInput
            initialValue={diagram.title}
            label="Diagram title"
            className="w-full"
            onCommit={props.onRename}
            onCancel={props.onEndRename}
          />
        ) : (
          <span className="truncate font-medium">{title}</span>
        )}
        <span className="flex items-center gap-1.5 text-2xs text-faint">
          <span className="rounded-xs bg-muted px-1.5 text-muted-foreground group-aria-selected/row:bg-panel">
            {typeName(diagram.code)}
          </span>
          {relativeTime(diagram.updatedAt, now)}
        </span>
        {hit.matchedIn === 'content' ? <MatchSnippet match={hit.match} /> : null}
      </span>
      {diagram.pinned ? <Pin aria-hidden="true" className="size-3.5 shrink-0 text-faint" /> : null}
      <DiagramRowMenu
        diagram={diagram}
        title={title}
        isOpen={props.isMenuOpen}
        onOpenChange={props.onMenuOpenChange}
        onCloseFocus={props.onMenuClosed}
      />
    </div>
  );
}
