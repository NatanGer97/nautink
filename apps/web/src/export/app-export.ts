import { DARK_QUERY, resolveTheme } from '@nautink/ui/theme';
import { toast } from 'sonner';

import { createExportActions, exportAvailability } from './export-actions.ts';
import { svgToPng } from './svg-to-png.ts';
import { useViewedVersion, useViewedVersionStore } from '../history/viewed-version.ts';
import { renderIdOf } from '../preview/background-render.tsx';
import { usePreviewStatus, usePreviewStatusStore } from '../preview/preview-status.ts';
import { useUiStore } from '../state/ui-store.ts';
import {
  selectActiveDiagram,
  useActiveDiagram,
  useWorkspaceStore,
} from '../workspace/use-workspace.ts';

import type { ExportActions, ExportDeps, ExportSource } from './export-actions.ts';
import type { PreviewStatus } from '../preview/preview-status.ts';
import type { Diagram, Version } from '@nautink/storage/records';

const ERROR_TOAST_MS: number = 6000;

/** The SVG only counts when it is the current render of this diagram (not a stale last render). */
function currentSvg(status: PreviewStatus, diagramId: string | undefined): string {
  return status.validity === 'valid' && status.diagramId === diagramId ? status.svg : '';
}

/** What is on the canvas: a version viewed in the history panel, or the diagram itself. */
function shownCode(diagram: Diagram | undefined, viewed: Version | null): string {
  return viewed?.code ?? diagram?.code ?? '';
}

/**
 * The open diagram and its render, read when an export runs. While the history panel views an older
 * version, that version is exported: what you see is what you export.
 */
export function readExportSource(): ExportSource {
  const diagram: Diagram | undefined = selectActiveDiagram(useWorkspaceStore.getState());
  const viewed: Version | null = useViewedVersionStore.getState().version;
  const isSystemDark: boolean = window.matchMedia(DARK_QUERY).matches;
  return {
    svg: currentSvg(usePreviewStatusStore.getState(), renderIdOf(diagram?.id ?? '', viewed)),
    code: shownCode(diagram, viewed),
    title: diagram?.title ?? '',
    isDark: resolveTheme(useUiStore.getState().themePreference, isSystemDark) === 'dark',
  };
}

/** Saves `blob` through a temporary link, the way browsers download generated files. */
export function downloadBlob(fileName: string, blob: Blob): void {
  const url: string = URL.createObjectURL(blob);
  const link: HTMLAnchorElement = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}

function openBlankTab(): Window | null {
  const tab: Window | null = window.open('about:blank', '_blank');
  if (tab !== null) {
    tab.opener = null;
  }
  return tab;
}

const BROWSER_EXPORT_DEPS: ExportDeps = {
  download: downloadBlob,
  writeText: async (text) => navigator.clipboard.writeText(text),
  writeImage: async (png) => navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]),
  openTab: openBlankTab,
  renderPng: svgToPng,
  notify: {
    success: (message) => toast(message),
    error: (message) => toast.error(message, { duration: ERROR_TOAST_MS }),
  },
};

/** The app's exports: the menu, ⌘K and the ⇧⌘E / ⇧⌘C shortcuts all run these. */
export const appExportActions: ExportActions = createExportActions(
  readExportSource,
  BROWSER_EXPORT_DEPS,
);

/** Whether image and text exports are available for the open diagram right now. */
export function useExportAvailability(): { hasImage: boolean; hasCode: boolean } {
  const status: PreviewStatus = usePreviewStatus();
  const diagram: Diagram | undefined = useActiveDiagram();
  const viewed: Version | null = useViewedVersion();
  return exportAvailability({
    svg: currentSvg(status, renderIdOf(diagram?.id ?? '', viewed)),
    code: shownCode(diagram, viewed),
    title: '',
    isDark: false,
  });
}
