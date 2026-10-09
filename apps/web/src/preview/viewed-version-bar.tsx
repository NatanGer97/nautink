import { Button } from '@nautink/ui/components/button';
import { IconButton } from '@nautink/ui/icon-button';
import { X } from 'lucide-react';
import { useEffect } from 'react';

import { restoreVersion } from '../history/version-actions.ts';
import { clockTime, versionText } from '../history/version-text.ts';
import { setCompareOpen, useViewedVersionStore, viewVersion } from '../history/viewed-version.ts';
import { OUTLINE_BUTTON_CLASS } from '../shell/button-styles.ts';

import type { Version } from '@nautink/storage/records';
import type { ReactElement } from 'react';

/** Esc goes back to the current code, unless something else (a menu, the compare) handled it. */
function useBackOnEscape(): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        viewVersion(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return (): void => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);
}

export interface ViewedVersionBarProps {
  version: Version;
  currentCode: string;
}

/**
 * Floats over the canvas while the history panel shows an older version on it (M5): what is on
 * view, "Compare with current", "Restore this version", and a way back to the current code.
 */
export function ViewedVersionBar({ version, currentCode }: ViewedVersionBarProps): ReactElement {
  const isCompareOpen: boolean = useViewedVersionStore((state) => state.isCompareOpen);
  useBackOnEscape();
  const isCurrent: boolean = version.code === currentCode;
  return (
    <section
      aria-label="Viewed version"
      className="absolute top-4 left-1/2 flex max-w-[calc(100%-32px)] -translate-x-1/2 items-center gap-2 rounded-float border bg-panel py-1.5 pr-1.5 pl-3 shadow-float"
    >
      <p className="min-w-0 truncate" aria-live="polite">
        <span className="text-muted-foreground">Viewing</span> {clockTime(version.createdAt)} ·{' '}
        {versionText(version)}
      </p>
      <Button
        variant="outline"
        size="sm"
        className={`shrink-0 ${OUTLINE_BUTTON_CLASS} aria-pressed:bg-muted dark:aria-pressed:bg-muted`}
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
        className="shrink-0"
        disabled={isCurrent}
        onClick={() => void restoreVersion(version)}
      >
        Restore this version
      </Button>
      <IconButton
        label="Back to the current code"
        shortcut="Esc"
        icon={<X />}
        onClick={() => {
          viewVersion(null);
        }}
      />
    </section>
  );
}
