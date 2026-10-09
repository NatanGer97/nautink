import { Button } from '@nautink/ui/components/button';
import { Kbd } from '@nautink/ui/components/kbd';
import { useEffect } from 'react';

import { EmptyState } from './empty-state.tsx';
import { PanelHeader } from './panel-header.tsx';
import { openSaveVersionDialog } from '../../history/save-version-dialog-store.ts';
import { VersionDetail } from '../../history/version-detail.tsx';
import { VersionList } from '../../history/version-list.tsx';
import { useVersionsStore, versionCountLabel } from '../../history/versions-store.ts';
import { useViewedVersion, viewVersion } from '../../history/viewed-version.ts';
import { SHORTCUTS, shortcutLabel } from '../../lib/shortcuts.ts';
import { useActiveDiagram } from '../../workspace/use-workspace.ts';
import { OUTLINE_BUTTON_CLASS } from '../button-styles.ts';

import type { Diagram, Version } from '@nautink/storage/records';
import type { ReactElement } from 'react';

function SaveVersionButton({ isDisabled }: { isDisabled: boolean }): ReactElement {
  return (
    <Button
      variant="outline"
      size="xs"
      className={OUTLINE_BUTTON_CLASS}
      disabled={isDisabled}
      onClick={openSaveVersionDialog}
    >
      Save version
      <Kbd className="bg-transparent font-mono text-2xs">
        {shortcutLabel(SHORTCUTS.saveVersion)}
      </Kbd>
    </Button>
  );
}

function subtitle(versions: readonly Version[] | null): string {
  return versions === null
    ? 'Kept in this browser'
    : `${versionCountLabel(versions.length)} · kept in this browser`;
}

/** What the panel shows under its header: loading, the empty state, or the versions. */
function HistoryBody({
  versions,
  code,
}: {
  versions: readonly Version[] | null;
  code: string;
}): ReactElement {
  const viewed: Version | null = useViewedVersion();
  const shown: Version | undefined = versions?.find((version) => version.id === viewed?.id);
  if (versions === null) {
    return <EmptyState title="Opening the history…">This takes a moment.</EmptyState>;
  }
  if (versions.length === 0) {
    return (
      <EmptyState title="No versions yet">
        Every change Claude makes is saved here, so you can compare and restore it. Press{' '}
        {shortcutLabel(SHORTCUTS.saveVersion)} to save one yourself.
      </EmptyState>
    );
  }
  return (
    <>
      {shown === undefined ? null : <VersionDetail version={shown} currentCode={code} />}
      <VersionList versions={versions} currentCode={code} viewedId={shown?.id ?? null} />
    </>
  );
}

/** Version history (M5): the open diagram's versions, newest first, to view, compare and restore. */
export function HistoryPanel(): ReactElement {
  const versions: readonly Version[] | null = useVersionsStore((state) => state.versions);
  const diagram: Diagram | undefined = useActiveDiagram();
  useEffect(
    () => (): void => {
      viewVersion(null);
    },
    [],
  );
  return (
    <>
      <PanelHeader
        title="History"
        subtitle={subtitle(versions)}
        actions={<SaveVersionButton isDisabled={diagram === undefined} />}
      />
      <div className="flex min-h-0 flex-1 flex-col" data-slot="version-list">
        <HistoryBody versions={versions} code={diagram?.code ?? ''} />
      </div>
    </>
  );
}
