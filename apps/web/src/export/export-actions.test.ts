import { describe, expect, it, vi } from 'vitest';

import { createExportActions, exportAvailability, NOTHING_TO_EXPORT } from './export-actions.ts';

import type { ExportActions, ExportDeps, ExportSource } from './export-actions.ts';
import type { Mock } from 'vitest';

const SOURCE: ExportSource = {
  svg: '<svg/>',
  code: 'flowchart TD\n  a',
  title: 'Checkout flow',
  isDark: false,
};

interface FakeDeps extends ExportDeps {
  download: Mock<ExportDeps['download']>;
  writeText: Mock<ExportDeps['writeText']>;
  writeImage: Mock<ExportDeps['writeImage']>;
  openTab: Mock<ExportDeps['openTab']>;
  renderPng: Mock<ExportDeps['renderPng']>;
  notify: { success: Mock<(message: string) => void>; error: Mock<(message: string) => void> };
}

interface Setup {
  actions: ExportActions;
  deps: FakeDeps;
  png: Blob;
}

const PNG = new Blob(['png'], { type: 'image/png' });

function fakeDeps(tab: Window | null): FakeDeps {
  return {
    download: vi.fn<ExportDeps['download']>(),
    writeText: vi.fn<ExportDeps['writeText']>(async () => Promise.resolve()),
    writeImage: vi.fn<ExportDeps['writeImage']>(async () => Promise.resolve()),
    openTab: vi.fn<ExportDeps['openTab']>(() => tab),
    renderPng: vi.fn<ExportDeps['renderPng']>(async () => Promise.resolve(PNG)),
    notify: {
      success: vi.fn<(message: string) => void>(),
      error: vi.fn<(message: string) => void>(),
    },
  };
}

function setup(source: Partial<ExportSource> = {}, tab: Window | null = null): Setup {
  const deps = fakeDeps(tab);
  const actions = createExportActions(() => ({ ...SOURCE, ...source }), deps);
  return { actions, deps, png: PNG };
}

describe('exportAvailability', () => {
  it('needs a render for images and code for text', () => {
    expect(exportAvailability(SOURCE)).toEqual({ hasImage: true, hasCode: true });
    expect(exportAvailability({ ...SOURCE, svg: '', code: '  ' })).toEqual({
      hasImage: false,
      hasCode: false,
    });
  });
});

describe('createExportActions', () => {
  it('downloads the SVG and the PNG under the diagram name', async () => {
    const { actions, deps, png } = setup();
    await actions.downloadSvg();
    expect(deps.download).toHaveBeenCalledWith('Checkout-flow.svg', expect.any(Blob));
    expect(deps.notify.success).toHaveBeenCalledWith('Downloaded Checkout-flow.svg');
    await actions.downloadPng({ scale: 3, isTransparent: false });
    expect(deps.renderPng).toHaveBeenCalledWith('<svg/>', { scale: 3, background: '#FFFFFF' });
    expect(deps.download).toHaveBeenLastCalledWith('Checkout-flow.png', png);
  });

  it('copies the image, transparent or on the dark panel color', async () => {
    const { actions, deps } = setup({ isDark: true });
    await actions.copyImage({ scale: 1, isTransparent: false });
    expect(deps.renderPng).toHaveBeenCalledWith('<svg/>', { scale: 1, background: '#1A1A19' });
    expect(deps.writeImage).toHaveBeenCalledWith(expect.any(Promise));
    await actions.copyImage({ scale: 2, isTransparent: true });
    expect(deps.renderPng).toHaveBeenLastCalledWith('<svg/>', { scale: 2, background: null });
    expect(deps.notify.success).toHaveBeenCalledWith('Image copied');
  });

  it('copies SVG, code, Markdown and the HTML embed', async () => {
    const { actions, deps } = setup();
    await actions.copySvg();
    await actions.copyCode();
    await actions.copyMarkdown();
    await actions.copyEmbed();
    expect(deps.writeText.mock.calls.map(([text]) => text.slice(0, 12))).toEqual([
      '<svg/>',
      'flowchart TD',
      '```mermaid\nf',
      '<pre class="',
    ]);
    expect(deps.notify.success.mock.calls.map(([message]) => message)).toEqual([
      'SVG copied',
      'Code copied',
      'Markdown copied',
      'HTML embed copied',
    ]);
  });

  it('refuses when there is nothing to export, and reports failures', async () => {
    const { actions, deps } = setup({ svg: '', code: '' });
    await actions.downloadSvg();
    await actions.copyCode();
    expect(deps.download).not.toHaveBeenCalled();
    expect(deps.notify.error).toHaveBeenCalledWith(NOTHING_TO_EXPORT);
    const failing = setup();
    failing.deps.writeText.mockRejectedValue(new Error('Clipboard blocked'));
    await failing.actions.copyCode();
    expect(failing.deps.notify.error).toHaveBeenCalledWith('Export failed: Clipboard blocked');
    failing.deps.writeText.mockRejectedValue('nope');
    await failing.actions.copyCode();
    expect(failing.deps.notify.error).toHaveBeenLastCalledWith('Export failed: nope');
  });

  it('opens mermaid.live in the tab it opened during the click', async () => {
    const tab = { location: { href: 'about:blank' } } as unknown as Window;
    const { actions, deps } = setup({}, tab);
    await actions.openInMermaidLive();
    expect(tab.location.href).toMatch(/^https:\/\/mermaid\.live\/edit#pako:/);
    expect(deps.notify.success).not.toHaveBeenCalled();
    const blocked = setup();
    await blocked.actions.openInMermaidLive();
    expect(blocked.deps.notify.error).toHaveBeenCalledWith(
      expect.stringContaining('Allow pop-ups'),
    );
  });
});
