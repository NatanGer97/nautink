import { Button } from '@nautink/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@nautink/ui/components/dropdown-menu';
import { cn } from '@nautink/ui/lib/utils';
import { Check, ExternalLink, Upload } from 'lucide-react';

import { appExportActions, useExportAvailability } from './app-export.ts';
import { currentPngChoice, usePngChoiceStore } from './png-choice.ts';
import { MAX_PNG_SCALE, MIN_PNG_SCALE } from './svg-to-png.ts';
import { useExportCommands } from './use-export-commands.ts';
import { SHORTCUTS, shortcutLabel } from '../lib/shortcuts.ts';
import { OUTLINE_BUTTON_CLASS } from '../shell/button-styles.ts';

import type { ExportActions } from './export-actions.ts';
import type { ReactElement } from 'react';

const SCALES: readonly number[] = [...Array(MAX_PNG_SCALE - MIN_PNG_SCALE + 1).keys()].map(
  (index: number) => MIN_PNG_SCALE + index,
);

interface ExportItemProps {
  title: string;
  description?: string;
  shortcut?: string;
  isDisabled: boolean;
  run: (actions: ExportActions) => Promise<void>;
}

/** One row: the format, a short note under it, and its shortcut (M4). */
function ExportItem({
  title,
  description,
  shortcut,
  isDisabled,
  run,
}: ExportItemProps): ReactElement {
  return (
    <DropdownMenuItem
      disabled={isDisabled}
      className="items-start rounded-control px-2.5 py-1.5"
      onSelect={() => {
        void run(appExportActions);
      }}
    >
      <span className="flex min-w-0 flex-col gap-px">
        <span>{title}</span>
        {description === undefined ? null : (
          <span className="text-xs text-faint">{description}</span>
        )}
      </span>
      {shortcut === undefined ? null : (
        <DropdownMenuShortcut className="font-mono text-2xs tracking-normal text-faint">
          {shortcut}
        </DropdownMenuShortcut>
      )}
    </DropdownMenuItem>
  );
}

function SectionLabel({ children }: { children: string }): ReactElement {
  return (
    <DropdownMenuLabel className="px-2.5 pt-2 pb-1 text-2xs font-medium text-faint">
      {children}
    </DropdownMenuLabel>
  );
}

function pngDescription(scale: number, isTransparent: boolean): string {
  return `${String(scale)}× resolution${isTransparent ? ', transparent' : ''}`;
}

/** The PNG scale (a segmented 1×–4× track) and the transparent background switch. */
function PngOptions({ isDisabled }: { isDisabled: boolean }): ReactElement {
  const scale: number = usePngChoiceStore((state) => state.scale);
  const isTransparent: boolean = usePngChoiceStore((state) => state.isTransparent);
  const { setScale, setTransparent } = usePngChoiceStore.getState();
  return (
    <div className="flex items-center gap-2.5 px-2.5 pt-1 pb-2">
      <DropdownMenuRadioGroup
        aria-label="PNG scale"
        value={String(scale)}
        onValueChange={(value: string) => {
          setScale(Number(value));
        }}
        className="flex gap-0.5 rounded-control bg-muted p-0.5"
      >
        {SCALES.map((option) => (
          <DropdownMenuRadioItem
            key={option}
            value={String(option)}
            disabled={isDisabled}
            onSelect={(event: Event) => {
              event.preventDefault();
            }}
            className={cn(
              'h-6 justify-center rounded-xs px-2 py-0 font-mono text-xs [&>span:first-child]:hidden',
              'text-muted-foreground data-[state=checked]:bg-panel data-[state=checked]:text-foreground data-[state=checked]:shadow-segment',
            )}
          >
            {`${String(option)}×`}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
      <DropdownMenuCheckboxItem
        checked={isTransparent}
        disabled={isDisabled}
        onCheckedChange={setTransparent}
        onSelect={(event: Event) => {
          event.preventDefault();
        }}
        className="gap-1.5 rounded-control px-1.5 py-1 text-xs text-muted-foreground [&>span:first-child]:hidden"
      >
        <span
          aria-hidden="true"
          className="grid size-3.5 place-items-center rounded-xs border border-input bg-panel"
        >
          {isTransparent ? <Check className="size-3 text-foreground" /> : null}
        </span>
        Transparent
      </DropdownMenuCheckboxItem>
    </div>
  );
}

interface Availability {
  hasImage: boolean;
  hasCode: boolean;
}

function DownloadSection({ hasImage }: Availability): ReactElement {
  const scale: number = usePngChoiceStore((state) => state.scale);
  const isTransparent: boolean = usePngChoiceStore((state) => state.isTransparent);
  return (
    <>
      <SectionLabel>Download</SectionLabel>
      <ExportItem
        title="SVG"
        description="Vector, sharp at any size"
        shortcut={shortcutLabel(SHORTCUTS.exportSvg)}
        isDisabled={!hasImage}
        run={async (actions) => actions.downloadSvg()}
      />
      <ExportItem
        title="PNG"
        description={pngDescription(scale, isTransparent)}
        isDisabled={!hasImage}
        run={async (actions) => actions.downloadPng(currentPngChoice())}
      />
      <PngOptions isDisabled={!hasImage} />
    </>
  );
}

function CopySection({ hasImage, hasCode }: Availability): ReactElement {
  return (
    <>
      <SectionLabel>Copy</SectionLabel>
      <ExportItem
        title="Image"
        description="PNG to the clipboard"
        shortcut={shortcutLabel(SHORTCUTS.copyImage)}
        isDisabled={!hasImage}
        run={async (actions) => actions.copyImage(currentPngChoice())}
      />
      <ExportItem
        title="SVG markup"
        isDisabled={!hasImage}
        run={async (actions) => actions.copySvg()}
      />
      <ExportItem
        title="Mermaid code"
        isDisabled={!hasCode}
        run={async (actions) => actions.copyCode()}
      />
      <ExportItem
        title="Markdown"
        description="Fenced block for GitHub, Notion, docs"
        isDisabled={!hasCode}
        run={async (actions) => actions.copyMarkdown()}
      />
      <ExportItem
        title="HTML embed"
        description="Renders with Mermaid from a CDN"
        isDisabled={!hasCode}
        run={async (actions) => actions.copyEmbed()}
      />
    </>
  );
}

/** The top bar's Export menu (PRD §3.6, M4): download, copy and share; also its ⌘K commands and shortcuts. */
export function ExportMenu(): ReactElement {
  useExportCommands();
  const availability: Availability = useExportAvailability();
  const isEmpty: boolean = !availability.hasImage && !availability.hasCode;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={isEmpty}>
        <Button
          variant="outline"
          size="sm"
          className={cn(OUTLINE_BUTTON_CLASS, 'aria-expanded:bg-muted')}
        >
          <Upload aria-hidden="true" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[300px] rounded-float p-1.5 shadow-menu">
        <DownloadSection {...availability} />
        <DropdownMenuSeparator className="mx-1.5 bg-border-subtle" />
        <CopySection {...availability} />
        <DropdownMenuSeparator className="mx-1.5 bg-border-subtle" />
        <DropdownMenuItem
          disabled={!availability.hasCode}
          className="rounded-control px-2.5 py-2"
          onSelect={() => {
            void appExportActions.openInMermaidLive();
          }}
        >
          Open in mermaid.live
          <ExternalLink aria-hidden="true" className="ml-auto" />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
