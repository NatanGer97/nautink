import { Button } from '@nautink/ui/components/button';
import { Kbd } from '@nautink/ui/components/kbd';

import { EmptyState } from './empty-state.tsx';
import { PanelHeader } from './panel-header.tsx';
import { SHORTCUTS, shortcutLabel } from '../../lib/shortcuts.ts';
import { OUTLINE_BUTTON_CLASS } from '../button-styles.ts';

import type { ReactElement } from 'react';

/** Version history (M5). The versions arrive with storage. */
export function HistoryPanel(): ReactElement {
  return (
    <>
      <PanelHeader
        title="History"
        subtitle="Kept in this browser"
        actions={
          <Button variant="outline" size="xs" className={OUTLINE_BUTTON_CLASS} disabled>
            Save version
            <Kbd className="bg-transparent font-mono text-2xs">
              {shortcutLabel(SHORTCUTS.saveVersion)}
            </Kbd>
          </Button>
        }
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-auto" data-slot="version-list">
        <EmptyState title="No versions yet">
          Every change Claude makes is saved here, so you can compare and restore it.
        </EmptyState>
      </div>
    </>
  );
}
