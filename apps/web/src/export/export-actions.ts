import { fileSlug } from '@nautink/storage/diagram-files';

import { embedHtml, markdownBlock, mermaidLiveUrl } from './export-formats.ts';

import type { PngOptions } from './svg-to-png.ts';

/** What an export reads, at the moment it runs. `svg` is empty unless the current code rendered. */
export interface ExportSource {
  svg: string;
  code: string;
  title: string;
  isDark: boolean;
}

/** The PNG choices in the export menu. */
export interface PngChoice {
  scale: number;
  isTransparent: boolean;
}

/** The browser side of exporting, swapped in tests. */
export interface ExportDeps {
  download: (fileName: string, blob: Blob) => void;
  writeText: (text: string) => Promise<void>;
  /** Takes the PNG as a promise so Safari still sees the click that asked for it. */
  writeImage: (png: Promise<Blob>) => Promise<void>;
  /** Opens a blank tab now (inside the click, so pop-up blockers allow it). */
  openTab: () => Window | null;
  renderPng: (svg: string, options: PngOptions) => Promise<Blob>;
  notify: { success: (message: string) => void; error: (message: string) => void };
}

export interface ExportActions {
  downloadSvg: () => Promise<void>;
  downloadPng: (choice: PngChoice) => Promise<void>;
  copyImage: (choice: PngChoice) => Promise<void>;
  copySvg: () => Promise<void>;
  copyCode: () => Promise<void>;
  copyMarkdown: () => Promise<void>;
  copyEmbed: () => Promise<void>;
  openInMermaidLive: () => Promise<void>;
}

/** PRD §6.1 panel colors: the fill behind a PNG that is not transparent. */
const PNG_BACKGROUND: Readonly<Record<'light' | 'dark', string>> = {
  light: '#FFFFFF',
  dark: '#1A1A19',
};

export const NOTHING_TO_EXPORT: string = 'Nothing to export yet';

/** Which exports make sense now: images need a current render, the text ones need code. */
export function exportAvailability(source: ExportSource): { hasImage: boolean; hasCode: boolean } {
  return { hasImage: source.svg !== '', hasCode: source.code.trim() !== '' };
}

function pngOptions(source: ExportSource, choice: PngChoice): PngOptions {
  const background: string = PNG_BACKGROUND[source.isDark ? 'dark' : 'light'];
  return { scale: choice.scale, background: choice.isTransparent ? null : background };
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

type Run = (
  need: 'image' | 'code',
  task: (source: ExportSource) => Promise<string | null>,
) => Promise<void>;

/** Runs one export: checks there is something to export, then reports success or failure. */
function runner(getSource: () => ExportSource, deps: ExportDeps): Run {
  return async (need, task): Promise<void> => {
    const source: ExportSource = getSource();
    const { hasImage, hasCode } = exportAvailability(source);
    if (!(need === 'image' ? hasImage : hasCode)) {
      deps.notify.error(NOTHING_TO_EXPORT);
      return;
    }
    try {
      const done: string | null = await task(source);
      if (done !== null) {
        deps.notify.success(done);
      }
    } catch (err) {
      deps.notify.error(`Export failed: ${errorText(err)}`);
    }
  };
}

function fileActions(
  run: Run,
  deps: ExportDeps,
): Pick<ExportActions, 'downloadSvg' | 'downloadPng'> {
  return {
    downloadSvg: async () =>
      run('image', async (source) => {
        const name: string = `${fileSlug(source.title)}.svg`;
        deps.download(name, new Blob([source.svg], { type: 'image/svg+xml' }));
        return Promise.resolve(`Downloaded ${name}`);
      }),
    downloadPng: async (choice) =>
      run('image', async (source) => {
        const name: string = `${fileSlug(source.title)}.png`;
        deps.download(name, await deps.renderPng(source.svg, pngOptions(source, choice)));
        return `Downloaded ${name}`;
      }),
  };
}

type CopyText = (
  need: 'image' | 'code',
  text: (source: ExportSource) => string,
  done: string,
) => Promise<void>;

function copier(run: Run, deps: ExportDeps): CopyText {
  return async (need, text, done) =>
    run(need, async (source) => {
      await deps.writeText(text(source));
      return done;
    });
}

function copyActions(
  run: Run,
  deps: ExportDeps,
): Omit<ExportActions, 'downloadSvg' | 'downloadPng' | 'openInMermaidLive'> {
  const copy: CopyText = copier(run, deps);
  return {
    copyImage: async (choice) =>
      run('image', async (source) => {
        await deps.writeImage(deps.renderPng(source.svg, pngOptions(source, choice)));
        return 'Image copied';
      }),
    copySvg: async () => copy('image', (source) => source.svg, 'SVG copied'),
    copyCode: async () => copy('code', (source) => source.code, 'Code copied'),
    copyMarkdown: async () =>
      copy('code', (source) => markdownBlock(source.code), 'Markdown copied'),
    copyEmbed: async () =>
      copy('code', (source) => embedHtml(source.code, source.isDark), 'HTML embed copied'),
  };
}

function openAction(run: Run, deps: ExportDeps): ExportActions['openInMermaidLive'] {
  return async () => {
    const tab: Window | null = deps.openTab();
    await run('code', async (source) => {
      if (tab === null) {
        throw new Error('the browser blocked the new tab. Allow pop-ups for this page.');
      }
      tab.location.href = await mermaidLiveUrl(source.code, source.isDark);
      return null;
    });
  };
}

/** Every export in the menu, ⌘K and the shortcuts (v1's `useExport`). */
export function createExportActions(
  getSource: () => ExportSource,
  deps: ExportDeps,
): ExportActions {
  const run: Run = runner(getSource, deps);
  return {
    ...fileActions(run, deps),
    ...copyActions(run, deps),
    openInMermaidLive: openAction(run, deps),
  };
}
