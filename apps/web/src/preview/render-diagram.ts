import { mermaidIconLoaders } from '../icons/icon-packs.ts';
import { initMermaid, loadMermaid } from '../mermaid/mermaid-instance.ts';
import { enqueueMermaid } from '../mermaid/mermaid-queue.ts';
import { toMermaidError } from '../mermaid/validate.ts';

import type { MermaidError } from '../mermaid/validate.ts';
import type { Mermaid } from 'mermaid';

/** A render that worked (with its SVG and time) or failed (with Mermaid's error). */
export type RenderOutcome =
  { kind: 'rendered'; svg: string; renderMs: number } | { kind: 'failed'; error: MermaidError };

export interface RenderRequest {
  code: string;
  isDark: boolean;
}

let renderCount: number = 0;
let isIconPacksRegistered: boolean = false;

/** Icon nodes (`id@{ icon: "logos:aws" }`) load their pack on first use. */
function registerIconPacksOnce(mermaid: Mermaid): void {
  if (!isIconPacksRegistered) {
    mermaid.registerIconPacks(mermaidIconLoaders());
    isIconPacksRegistered = true;
  }
}

/** A failed render leaves its scratch element in the page; Mermaid names it `id` or `d<id>`. */
function removeScratch(id: string): void {
  document.getElementById(id)?.remove();
  document.getElementById(`d${id}`)?.remove();
}

async function renderJob(
  mermaid: Mermaid,
  { code, isDark }: RenderRequest,
  id: string,
): Promise<RenderOutcome> {
  await initMermaid(isDark);
  const started: number = performance.now();
  await mermaid.parse(code);
  const { svg } = await mermaid.render(id, code);
  return { kind: 'rendered', svg, renderMs: Math.round(performance.now() - started) };
}

/** Parses and renders `code` through the shared queue, in the theme asked for. */
export async function renderDiagram(request: RenderRequest): Promise<RenderOutcome> {
  renderCount += 1;
  const id: string = `nautink-render-${String(renderCount)}`;
  try {
    const mermaid: Mermaid = await loadMermaid();
    registerIconPacksOnce(mermaid);
    return await enqueueMermaid(async () => renderJob(mermaid, request, id));
  } catch (err) {
    removeScratch(id);
    return { kind: 'failed', error: toMermaidError(err) };
  }
}
