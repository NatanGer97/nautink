import { Button } from '@nautink/ui/components/button';
import { Kbd } from '@nautink/ui/components/kbd';
import { Separator } from '@nautink/ui/components/separator';
import { IconButton } from '@nautink/ui/icon-button';
import { cn } from '@nautink/ui/lib/utils';
import { Code, Redo2, Search, Undo2, Upload } from 'lucide-react';

import { OUTLINE_BUTTON_CLASS } from './button-styles.ts';
import { CanvasModeToggle } from './canvas-mode-toggle.tsx';
import { LogoMark } from './logo-mark.tsx';
import { SHORTCUTS, shortcutLabel } from '../lib/shortcuts.ts';
import { useUiStore } from '../state/ui-store.ts';

import type { ReactElement } from 'react';

export interface TopBarProps {
  /** The open diagram's title. Placeholder until storage lands. */
  title?: string;
  /** "Saved", "Saving…" or "Unsaved changes". */
  saveState?: string;
}

function PaletteButton(): ReactElement {
  const setPaletteOpen: (isOpen: boolean) => void = useUiStore((state) => state.setPaletteOpen);
  const shortcut: string = shortcutLabel(SHORTCUTS.palette);
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className={cn(OUTLINE_BUTTON_CLASS, 'w-[200px] justify-between font-normal max-lg:hidden')}
        onClick={() => {
          setPaletteOpen(true);
        }}
      >
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <Search aria-hidden="true" />
          Search or run…
        </span>
        <Kbd className="bg-transparent font-mono text-2xs">{shortcut}</Kbd>
      </Button>
      <IconButton
        label="Search or run a command"
        shortcut={shortcut}
        icon={<Search />}
        className="lg:hidden"
        onClick={() => {
          setPaletteOpen(true);
        }}
      />
    </>
  );
}

/** The 48 px top bar: identity, canvas mode, code drawer, history, palette and export (PRD §5). */
export function TopBar({
  title = 'Untitled diagram',
  saveState = 'Saved',
}: TopBarProps): ReactElement {
  const isCodeDrawerOpen: boolean = useUiStore((state) => state.isCodeDrawerOpen);
  const toggleCodeDrawer: () => void = useUiStore((state) => state.toggleCodeDrawer);
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-panel px-3">
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <LogoMark />
        <span className="text-base font-semibold">Nautink</span>
        <span aria-hidden="true" className="text-faint max-md:hidden">
          /
        </span>
        <span className="truncate font-medium max-md:hidden">{title}</span>
        <span className="text-xs text-muted-foreground max-md:hidden">{saveState}</span>
      </div>
      <div className="flex items-center gap-2">
        <CanvasModeToggle />
        <Button
          variant="outline"
          size="sm"
          aria-pressed={isCodeDrawerOpen}
          className={cn(
            OUTLINE_BUTTON_CLASS,
            'aria-pressed:border-accent-ink aria-pressed:bg-accent-wash aria-pressed:text-accent-ink-strong',
          )}
          onClick={toggleCodeDrawer}
        >
          <Code aria-hidden="true" />
          Code
        </Button>
      </div>
      <div className="flex flex-1 items-center justify-end gap-1">
        <IconButton
          label="Undo"
          shortcut={shortcutLabel(SHORTCUTS.undo)}
          icon={<Undo2 />}
          isDisabled
        />
        <IconButton
          label="Redo"
          shortcut={shortcutLabel(SHORTCUTS.redo)}
          icon={<Redo2 />}
          isDisabled
        />
        <Separator orientation="vertical" className="mx-1.5 data-[orientation=vertical]:h-5" />
        <PaletteButton />
        <Button variant="outline" size="sm" className={OUTLINE_BUTTON_CLASS} disabled>
          <Upload aria-hidden="true" />
          Export
        </Button>
      </div>
    </header>
  );
}
