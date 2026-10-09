import { Button } from '@nautink/ui/components/button';
import { IconButton } from '@nautink/ui/icon-button';
import { cn } from '@nautink/ui/lib/utils';
import { X } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';

import { diffLines, diffStats } from './line-diff.ts';
import { restoreVersion } from './version-actions.ts';
import { setCompareOpen, useViewedVersionStore } from './viewed-version.ts';
import { useActiveDiagram } from '../workspace/use-workspace.ts';

import type { DiffLine, DiffStats } from './line-diff.ts';
import type { Diagram, Version } from '@nautink/storage/records';
import type { ReactElement, RefObject } from 'react';

const LINE_CLASSES: Readonly<Record<DiffLine['kind'], string>> = {
  same: '',
  added: 'bg-success-bg text-success',
  removed: 'bg-destructive-bg text-destructive',
};

const LINE_MARKS: Readonly<Record<DiffLine['kind'], string>> = {
  same: ' ',
  added: '+',
  removed: '−',
};

const LINE_WORDS: Readonly<Record<DiffLine['kind'], string>> = {
  same: '',
  added: 'Added: ',
  removed: 'Removed: ',
};

function DiffBody({ lines }: { lines: readonly DiffLine[] }): ReactElement {
  return (
    <div className="min-h-0 flex-1 overflow-auto py-2.5 font-mono text-code text-muted-foreground">
      {lines.map((line, index) => (
        // Lines repeat, so their position is the only stable key.
        <div key={index} className={cn('px-3.5 whitespace-pre', LINE_CLASSES[line.kind])}>
          <span className="sr-only">{LINE_WORDS[line.kind]}</span>
          <span aria-hidden="true">{LINE_MARKS[line.kind]} </span>
          {line.text}
        </div>
      ))}
    </div>
  );
}

function DrawerContent({ version, code }: { version: Version; code: string }): ReactElement {
  const lines: DiffLine[] = useMemo(() => diffLines(version.code, code), [version.code, code]);
  const stats: DiffStats = diffStats(lines);
  return (
    <>
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border-subtle pr-2 pl-3.5">
        <span className="flex flex-col">
          <h2 id="compare-title" className="font-semibold">
            Changes since this version
          </h2>
          <span className="text-xs">
            <span className="text-success">+{stats.added}</span>{' '}
            <span className="text-destructive">−{stats.removed}</span>{' '}
            <span className="text-faint">lines</span>
          </span>
        </span>
        <IconButton
          label="Close compare"
          shortcut="Esc"
          icon={<X />}
          onClick={() => {
            setCompareOpen(false);
          }}
        />
      </div>
      <DiffBody lines={lines} />
      <div className="flex shrink-0 items-center gap-3 border-t border-border-subtle px-3.5 py-2.5 text-xs text-faint">
        <span className="flex-1">
          Restoring keeps the current version in history, so you can undo it.
        </span>
        <Button size="sm" onClick={() => void restoreVersion(version)}>
          Restore this version
        </Button>
      </div>
    </>
  );
}

/** The compare drawer (M5): a line diff from the viewed version to the current code. */
export function CompareDrawer(): ReactElement | null {
  const version: Version | null = useViewedVersionStore((state) =>
    state.isCompareOpen ? state.version : null,
  );
  const diagram: Diagram | undefined = useActiveDiagram();
  const ref: RefObject<HTMLElement | null> = useRef<HTMLElement>(null);
  const isOpen: boolean = version !== null;
  useEffect(() => {
    const drawer: HTMLElement | null = ref.current;
    if (!isOpen || drawer === null) {
      return undefined;
    }
    drawer.focus();
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setCompareOpen(false);
      }
    };
    drawer.addEventListener('keydown', onKeyDown);
    return (): void => {
      drawer.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);
  if (version === null || diagram === undefined) {
    return null;
  }
  return (
    <section
      ref={ref}
      tabIndex={-1}
      aria-labelledby="compare-title"
      className="fixed top-12 right-0 bottom-7 z-40 flex w-[400px] max-w-full flex-col border-l bg-panel shadow-float outline-none"
    >
      <DrawerContent version={version} code={diagram.code} />
    </section>
  );
}
