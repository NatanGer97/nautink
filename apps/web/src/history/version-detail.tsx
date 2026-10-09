import { Button } from '@nautink/ui/components/button';
import { IconButton } from '@nautink/ui/icon-button';
import { Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { deleteVersionWithUndo, renameVersionLabel, restoreVersion } from './version-actions.ts';
import { clockTime, versionText } from './version-text.ts';
import { setCompareOpen, useViewedVersionStore } from './viewed-version.ts';
import { DiagramThumbnail } from '../mermaid/diagram-thumbnail.tsx';
import { OUTLINE_BUTTON_CLASS } from '../shell/button-styles.ts';
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
 * The viewed version, read-only: its picture and code, with "Compare with current" and "Restore
 * this version" (M5). Shown in the panel until the canvas can show it (`useViewedVersion`).
 */
export function VersionDetail({ version, currentCode }: VersionDetailProps): ReactElement {
  const isCompareOpen: boolean = useViewedVersionStore((state) => state.isCompareOpen);
  const isCurrent: boolean = version.code === currentCode;
  return (
    <section
      aria-label="Viewed version"
      className="flex shrink-0 flex-col gap-2.5 border-b border-border-subtle p-3"
    >
      <ViewingBar key={version.id} version={version} />
      {version.prompt !== '' && version.label !== '' ? (
        <p className="truncate text-xs text-muted-foreground" title={version.prompt}>
          “{version.prompt}”
        </p>
      ) : null}
      <DiagramThumbnail code={version.code} isEager className="h-28 w-full" />
      <pre
        aria-label="Version code"
        className="max-h-40 overflow-auto rounded-track border bg-subtle px-3 py-2 font-mono text-code"
      >
        {version.code}
      </pre>
      <div className="flex gap-1.5">
        <Button
          variant="outline"
          size="sm"
          className={`flex-1 ${OUTLINE_BUTTON_CLASS} aria-pressed:bg-muted dark:aria-pressed:bg-muted`}
          aria-pressed={isCompareOpen}
          disabled={isCurrent}
          onClick={() => {
            setCompareOpen(!isCompareOpen);
          }}
        >
          Compare with current
        </Button>
        <Button
          size="sm"
          className="flex-1"
          disabled={isCurrent}
          onClick={() => void restoreVersion(version)}
        >
          Restore this version
        </Button>
      </div>
      {isCurrent ? (
        <p className="text-xs text-muted-foreground">This version is the current code.</p>
      ) : null}
    </section>
  );
}
