import { useEffect, useMemo } from 'react';

import { appExportActions, useExportAvailability } from './app-export.ts';
import { currentPngChoice } from './png-choice.ts';
import { useRegisterCommands } from '../commands/use-commands.ts';
import { matchesShortcut, SHORTCUTS, shortcutLabel } from '../lib/shortcuts.ts';

import type { ExportActions } from './export-actions.ts';
import type { AppCommand } from '../commands/command-registry.ts';
import type { KeyEventLike } from '../lib/shortcuts.ts';

interface ExportCommandSpec {
  id: string;
  title: string;
  /** Images need a current render; the text exports only need code. */
  needs: 'image' | 'code';
  run: (actions: ExportActions) => Promise<void>;
  shortcut?: string;
}

const SPECS: readonly ExportCommandSpec[] = [
  {
    id: 'export.svg',
    title: 'Download SVG',
    needs: 'image',
    run: async (actions) => actions.downloadSvg(),
    shortcut: shortcutLabel(SHORTCUTS.exportSvg),
  },
  {
    id: 'export.png',
    title: 'Download PNG',
    needs: 'image',
    run: async (actions) => actions.downloadPng(currentPngChoice()),
  },
  {
    id: 'export.copy-image',
    title: 'Copy image',
    needs: 'image',
    run: async (actions) => actions.copyImage(currentPngChoice()),
    shortcut: shortcutLabel(SHORTCUTS.copyImage),
  },
  {
    id: 'export.copy-svg',
    title: 'Copy SVG markup',
    needs: 'image',
    run: async (a) => a.copySvg(),
  },
  {
    id: 'export.copy-code',
    title: 'Copy Mermaid code',
    needs: 'code',
    run: async (a) => a.copyCode(),
  },
  {
    id: 'export.copy-markdown',
    title: 'Copy as Markdown',
    needs: 'code',
    run: async (a) => a.copyMarkdown(),
  },
  {
    id: 'export.copy-embed',
    title: 'Copy HTML embed',
    needs: 'code',
    run: async (a) => a.copyEmbed(),
  },
  {
    id: 'export.mermaid-live',
    title: 'Open in mermaid.live',
    needs: 'code',
    run: async (a) => a.openInMermaidLive(),
  },
];

/** The export commands for ⌘K, disabled while there is nothing they could export. */
export function buildExportCommands(
  actions: ExportActions,
  availability: { hasImage: boolean; hasCode: boolean },
): AppCommand[] {
  return SPECS.map(({ id, title, needs, run, shortcut }) => ({
    id,
    group: 'Export',
    title,
    keywords: ['export', 'share'],
    isDisabled: needs === 'image' ? !availability.hasImage : !availability.hasCode,
    run: (): void => {
      void run(actions);
    },
    ...(shortcut === undefined ? {} : { shortcut }),
  }));
}

/** ⇧⌘E downloads the SVG, ⇧⌘C copies the image. Undefined for any other key. */
export function exportShortcutAction(event: KeyEventLike): (() => Promise<void>) | undefined {
  if (matchesShortcut(event, SHORTCUTS.exportSvg)) {
    return appExportActions.downloadSvg;
  }
  if (matchesShortcut(event, SHORTCUTS.copyImage)) {
    return async () => appExportActions.copyImage(currentPngChoice());
  }
  return undefined;
}

function useExportShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const action: (() => Promise<void>) | undefined = exportShortcutAction(event);
      if (action !== undefined && !event.isComposing && !event.altKey) {
        event.preventDefault();
        void action();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return (): void => {
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, []);
}

/** Registers the export commands and the two export shortcuts while the app is mounted. */
export function useExportCommands(): void {
  const { hasImage, hasCode } = useExportAvailability();
  const commands: AppCommand[] = useMemo(
    () => buildExportCommands(appExportActions, { hasImage, hasCode }),
    [hasImage, hasCode],
  );
  useRegisterCommands(commands);
  useExportShortcuts();
}
