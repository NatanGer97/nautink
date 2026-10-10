import { useEffect } from 'react';

import { VersionRow, versionRowId } from './version-row.tsx';
import { groupByDay, KIND_LABELS, kindLabel, versionText } from './version-text.ts';
import { viewVersion } from './viewed-version.ts';
import { nextCursor } from '../workspace/panel/diagram-list-model.ts';
import { useNow } from '../workspace/use-now.ts';

import type { Version } from '@nautink/storage/records';
import type { KeyboardEvent, ReactElement } from 'react';

/** The id of the "Current" row at the top of the list. */
const CURRENT_ROW: string = 'current';

export interface VersionListProps {
  versions: readonly Version[];
  currentCode: string;
  viewedId: string | null;
}

/** Arrows, Home and End view another version; Escape goes back to the current code. */
function onListKey(event: KeyboardEvent<HTMLDivElement>, props: VersionListProps): void {
  const ids: string[] = [CURRENT_ROW, ...props.versions.map((version) => version.id)];
  if (event.key === 'Escape' && props.viewedId !== null) {
    event.preventDefault();
    event.stopPropagation();
    viewVersion(null);
    return;
  }
  const next: string | undefined = nextCursor(ids, props.viewedId ?? CURRENT_ROW, event.key);
  if (next !== undefined) {
    event.preventDefault();
    viewVersion(props.versions.find((version) => version.id === next) ?? null);
  }
}

/** The versions, newest first under day headings, after a "Current" row (M5). */
export function VersionList(props: VersionListProps): ReactElement {
  const { versions, currentCode, viewedId } = props;
  const now: number = useNow();
  const selectedRow: string = versionRowId(viewedId ?? CURRENT_ROW);
  useEffect(() => {
    document.getElementById(selectedRow)?.scrollIntoView({ block: 'nearest' });
  }, [selectedRow]);
  return (
    <div
      role="listbox"
      aria-label="Versions"
      tabIndex={0}
      aria-activedescendant={selectedRow}
      className="group/list flex min-h-0 flex-1 flex-col gap-0.5 overflow-auto p-2 outline-none"
      onKeyDown={(event) => {
        onListKey(event, props);
      }}
    >
      <VersionRow
        id={CURRENT_ROW}
        kind="current"
        badge={KIND_LABELS.current}
        code={currentCode}
        createdAt={null}
        text="Current version"
        isSelected={viewedId === null}
        onSelect={() => {
          viewVersion(null);
        }}
      />
      {groupByDay(versions, now).map((group) => (
        <div
          key={group.label}
          role="group"
          aria-label={group.label}
          className="flex flex-col gap-0.5"
        >
          <div aria-hidden="true" className="px-1.5 pt-2.5 pb-1 text-2xs font-medium text-faint">
            {group.label}
          </div>
          {group.versions.map((version) => (
            <VersionRow
              key={version.id}
              id={version.id}
              kind={version.kind}
              badge={kindLabel(version)}
              code={version.code}
              createdAt={version.createdAt}
              text={versionText(version)}
              isSelected={version.id === viewedId}
              onSelect={() => {
                viewVersion(version);
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
