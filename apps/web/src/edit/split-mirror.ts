import { requestSelection } from './selection/canvas-selection.ts';
import { hitFromElement } from '../preview/locate.ts';
import { revealShapeInCode } from '../preview/preview-canvas.tsx';
import { STAGE_ATTRIBUTE } from '../preview/use-pan-zoom.ts';

/**
 * A click on a shape in Split's preview half: select its code line (as in Preview) and select the
 * same item in the editor half (PRD §3.3: "also selects the node on the canvas in Split").
 */
export function mirrorShapeClick(diagramId: string, code: string, target: Element): void {
  revealShapeInCode(diagramId, code, target);
  const stage: Element | null = target.closest(`[${STAGE_ATTRIBUTE}]`);
  const ids: string[] = stage === null ? [] : hitFromElement(target, stage).ids;
  if (ids.length > 0) {
    requestSelection(diagramId, ids);
  }
}
