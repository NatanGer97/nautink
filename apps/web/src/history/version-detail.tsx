import { IconButton } from '@nautink/ui/icon-button';
import { Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { deleteVersionWithUndo, renameVersionLabel } from './version-actions.ts';
import { clockTime, versionText } from './version-text.ts';
import { InlineRenameInput } from '../workspace/inline-rename-input.tsx';

import type { Version } from '@nautink/storage/records';
import type { ReactElement } from 'react';

export interface VersionDetailProps {
  version: Version;
  currentCode: string;
}

/** "Viewing 10:42 · First draft" with rename and delete, or the name field while renaming. */
function ViewingBar({ version }: { version: Version }): ReactElement {
  const [isRenaming, setRenaming] = useState<boolean>(false);
  if (isRenaming) {
    return (
      <InlineRenameInput
        initialValue={version.label}
        label="Version name"
        className="w-full"
        onCommit={(label: string) => {
          setRenaming(false);
          void renameVersionLabel(version, label);
        }}
        onCancel={() => {
          setRenaming(false);
        }}
      />
    );
  }
  return (
    <div className="flex items-center gap-1">
      <p className="min-w-0 flex-1 truncate" aria-live="polite">
        <span className="text-muted-foreground">Viewing</span> {clockTime(version.createdAt)} ·{' '}
        {versionText(version)}
      </p>
      <IconButton
        label={version.label === '' ? 'Name version' : 'Rename version'}
        icon={<Pencil />}
        className="size-7"
        onClick={() => {
          setRenaming(true);
        }}
      />
      <IconButton
        label="Delete version"
        icon={<Trash2 />}
        className="size-7"
        onClick={() => void deleteVersionWithUndo(version)}
      />
    </div>
  );
}

/**
 * The viewed version's details in the panel: its name (rename, delete) and Claude's prompt. The
 * version itself shows on the canvas, read-only, with "Compare with current" and "Restore this
 * version" (`preview/viewed-version-bar.tsx`, M5).
 */
export function VersionDetail({ version, currentCode }: VersionDetailProps): ReactElement {
  const isCurrent: boolean = version.code === currentCode;
  return (
    <section
      aria-label="Version details"
      className="flex shrink-0 flex-col gap-2 border-b border-border-subtle p-3"
    >
      <ViewingBar key={version.id} version={version} />
      {version.prompt !== '' && version.label !== '' ? (
        <p className="truncate text-xs text-muted-foreground" title={version.prompt}>
          “{version.prompt}”
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground">
        {isCurrent ? 'This version is the current code.' : 'Shown on the canvas, read-only.'}
      </p>
    </section>
  );
}
