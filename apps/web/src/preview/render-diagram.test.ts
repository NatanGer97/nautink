import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderDiagram } from './render-diagram.ts';

const fakeMermaid = vi.hoisted(() => ({
  parse: vi.fn(async () => Promise.resolve({})),
  render: vi.fn(async (id: string) => Promise.resolve({ svg: `<svg id="${id}"></svg>` })),
  registerIconPacks: vi.fn(),
}));

const initMermaid = vi.hoisted(() => vi.fn(async () => Promise.resolve()));

vi.unmock('./render-diagram.ts');

vi.mock('../mermaid/mermaid-instance.ts', () => ({
  loadMermaid: async (): Promise<typeof fakeMermaid> => Promise.resolve(fakeMermaid),
  initMermaid,
}));

beforeEach(() => {
  fakeMermaid.parse.mockClear();
  fakeMermaid.render.mockClear();
  initMermaid.mockClear();
});

describe('renderDiagram', () => {
  it('initializes the theme, parses, renders and times the render', async () => {
    const outcome = await renderDiagram({ code: 'flowchart TD\n  a', isDark: true });
    expect(initMermaid).toHaveBeenCalledWith(true);
    expect(fakeMermaid.parse).toHaveBeenCalledWith('flowchart TD\n  a');
    expect(outcome.kind === 'rendered' && outcome.svg).toContain('<svg');
    expect(outcome.kind === 'rendered' && outcome.renderMs).toBeGreaterThanOrEqual(0);
    const [loaders] = fakeMermaid.registerIconPacks.mock.calls[0] as [{ name: string }[]];
    expect(loaders.map((loader) => loader.name)).toContain('fa');
  });

  it('does not register the icon packs again', async () => {
    await renderDiagram({ code: 'b', isDark: false });
    expect(fakeMermaid.registerIconPacks).not.toHaveBeenCalled();
  });

  it('returns the parse error without rendering', async () => {
    fakeMermaid.parse.mockRejectedValueOnce(new Error('Parse error on line 2'));
    const outcome = await renderDiagram({ code: 'flowchart TD\n  a -->', isDark: false });
    expect(outcome).toEqual({
      kind: 'failed',
      error: { message: 'Parse error on line 2', line: 2 },
    });
    expect(fakeMermaid.render).not.toHaveBeenCalled();
  });

  it('removes the scratch element a failed render leaves behind', async () => {
    fakeMermaid.render.mockImplementationOnce(async (id: string) => {
      const scratch = document.createElement('div');
      scratch.id = `d${id}`;
      document.body.append(scratch);
      return Promise.reject(new Error('Cannot read getBBox'));
    });
    const outcome = await renderDiagram({ code: 'flowchart TD', isDark: false });
    expect(outcome).toEqual({
      kind: 'failed',
      error: { message: 'Cannot read getBBox', line: null },
    });
    expect(document.querySelectorAll('[id^="dnautink-render-"]')).toHaveLength(0);
  });
});
