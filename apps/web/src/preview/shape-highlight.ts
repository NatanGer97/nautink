import { useLayoutEffect } from 'react';

import { idsOf } from './locate.ts';

import type { RefObject } from 'react';

/** Marks a rendered shape that is selected in the visual editor (Split mirrors the selection). */
export const SELECTED_ATTRIBUTE: string = 'data-canvas-selected';

/** Marks the groups in `stage` whose diagram id is in `ids`, and unmarks the rest. Returns the marked count. */
export function markSelectedShapes(stage: Element, ids: ReadonlySet<string>): number {
  let marked: number = 0;
  for (const group of stage.querySelectorAll('g[id]')) {
    const isSelected: boolean = idsOf(group).some((id) => ids.has(id));
    group.toggleAttribute(SELECTED_ATTRIBUTE, isSelected);
    marked += isSelected ? 1 : 0;
  }
  return marked;
}

/** Keeps the selection marks on the rendered SVG in step with `ids` and each new render. */
export function useShapeHighlight(
  stageRef: RefObject<HTMLElement | null>,
  svg: string,
  ids: readonly string[],
): void {
  const key: string = ids.join('\n');
  useLayoutEffect(() => {
    const stage: HTMLElement | null = stageRef.current;
    if (stage !== null) {
      markSelectedShapes(stage, new Set(key === '' ? [] : key.split('\n')));
    }
  }, [stageRef, svg, key]);
}
