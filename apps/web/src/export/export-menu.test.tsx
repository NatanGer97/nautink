import { TooltipProvider } from '@nautink/ui/components/tooltip';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { appExportActions, downloadBlob, readExportSource } from './app-export.ts';
import { ExportMenu } from './export-menu.tsx';
import { usePngChoiceStore } from './png-choice.ts';
import { buildExportCommands, exportShortcutAction } from './use-export-commands.ts';
import { commandRegistry } from '../commands/command-registry.ts';
import { usePreviewStatusStore } from '../preview/preview-status.ts';
import { useWorkspaceStore } from '../workspace/use-workspace.ts';

afterEach(() => {
  usePreviewStatusStore.getState().reset();
  usePngChoiceStore.setState({ scale: 2, isTransparent: false });
  vi.restoreAllMocks();
});

async function renderMenu(): Promise<ReturnType<typeof userEvent.setup>> {
  await useWorkspaceStore.getState().load();
  render(
    <TooltipProvider>
      <ExportMenu />
    </TooltipProvider>,
  );
  return userEvent.setup();
}

function reportRendered(): void {
  const diagramId = useWorkspaceStore.getState().activeId ?? '';
  act(() => {
    usePreviewStatusStore
      .getState()
      .report({ kind: 'rendered', diagramId, svg: '<svg/>', renderMs: 1 });
  });
}

async function openMenu(user: ReturnType<typeof userEvent.setup>): Promise<HTMLElement> {
  act(() => {
    screen.getByRole('button', { name: 'Export' }).focus();
  });
  await user.keyboard('{Enter}');
  return screen.findByRole('menu');
}

describe('the export menu', () => {
  it('offers only the text exports until the diagram renders', async () => {
    const user = await renderMenu();
    const menu = await openMenu(user);
    expect(
      within(menu)
        .getByRole('menuitem', { name: /^SVG\s*Vector/ })
        .getAttribute('aria-disabled'),
    ).toBe('true');
    expect(
      within(menu).getByRole('menuitem', { name: 'Mermaid code' }).getAttribute('aria-disabled'),
    ).toBeNull();
    expect(readExportSource()).toMatchObject({ svg: '', code: 'flowchart TD\n', isDark: false });
  });

  it('runs an export, and keeps the PNG choices open in the menu', async () => {
    const downloadPng = vi.spyOn(appExportActions, 'downloadPng').mockResolvedValue(undefined);
    const user = await renderMenu();
    reportRendered();
    const menu = await openMenu(user);
    await user.click(within(menu).getByRole('menuitemradio', { name: '4×' }));
    await user.click(within(menu).getByRole('menuitemcheckbox', { name: 'Transparent' }));
    expect(within(menu).getByText('4× resolution, transparent')).toBeTruthy();
    await user.click(within(menu).getByRole('menuitem', { name: /^PNG/ }));
    expect(downloadPng).toHaveBeenCalledWith({ scale: 4, isTransparent: true });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('registers the export commands, enabled when there is something to export', async () => {
    await renderMenu();
    const svgCommand = (): boolean | undefined =>
      commandRegistry.getCommands().find((command) => command.id === 'export.svg')?.isDisabled;
    expect(svgCommand()).toBe(true);
    reportRendered();
    expect(svgCommand()).toBe(false);
  });

  it('downloads the SVG on ⇧⌘E', async () => {
    const downloadSvg = vi.spyOn(appExportActions, 'downloadSvg').mockResolvedValue(undefined);
    await renderMenu();
    fireEvent.keyDown(window, { key: 'E', metaKey: true, shiftKey: true });
    expect(downloadSvg).toHaveBeenCalled();
  });
});

describe('export commands and shortcuts', () => {
  it('maps every command to its action', () => {
    const actions = {
      downloadSvg: vi.fn(),
      downloadPng: vi.fn(),
      copyImage: vi.fn(),
      copySvg: vi.fn(),
      copyCode: vi.fn(),
      copyMarkdown: vi.fn(),
      copyEmbed: vi.fn(),
      openInMermaidLive: vi.fn(),
    };
    const commands = buildExportCommands(actions, {
      hasImage: false,
      hasCode: true,
    });
    for (const command of commands) {
      command.run();
    }
    expect(Object.values(actions).every((action) => action.mock.calls.length === 1)).toBe(true);
    expect(commands.find((command) => command.id === 'export.copy-code')?.isDisabled).toBe(false);
    expect(commands.find((command) => command.id === 'export.png')?.isDisabled).toBe(true);
  });

  it('knows the two export shortcuts', async () => {
    const copyImage = vi.spyOn(appExportActions, 'copyImage').mockResolvedValue(undefined);
    const key = { metaKey: true, ctrlKey: false, shiftKey: true };
    expect(exportShortcutAction({ ...key, key: 'E' })).toBe(appExportActions.downloadSvg);
    await exportShortcutAction({ ...key, key: 'c' })?.();
    expect(copyImage).toHaveBeenCalledWith({ scale: 2, isTransparent: false });
    expect(exportShortcutAction({ ...key, key: 'x' })).toBeUndefined();
  });

  it('downloads a blob through a temporary link', () => {
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    downloadBlob('a.svg', new Blob(['x']));
    expect(click).toHaveBeenCalled();
  });
});
