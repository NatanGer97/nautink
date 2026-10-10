import { describe, expect, it } from 'vitest';

import { PROMPT_GAP_PX, PROMPT_MARGIN_PX, placePrompt, unionBox } from './prompt-placement.ts';

import type { Box, PlacementInput } from './prompt-placement.ts';

const CONTAINER = { width: 1000, height: 700 };
const PROMPT = { width: 300, height: 42 };

/** A box from `[left, top, width, height]`. */
function box([left, top, width, height]: [number, number, number, number]): Box {
  return { left, top, right: left + width, bottom: top + height };
}

function input(target: Box, obstacles: Box[] = []): PlacementInput {
  return { target, container: CONTAINER, prompt: PROMPT, obstacles };
}

/** M1's chrome: the toolbar top-left, the 248 px inspector top-right, the zoom bar bottom-right. */
const TOOLBAR = box([16, 16, 260, 40]);
const INSPECTOR = box([736, 16, 248, 420]);
const ZOOM = box([840, 644, 144, 40]);

describe('unionBox', () => {
  it('is null for nothing and spans every box', () => {
    expect(unionBox([])).toBeNull();
    expect(unionBox([box([10, 20, 30, 40]), box([100, 5, 10, 10])])).toEqual({
      left: 10,
      top: 5,
      right: 110,
      bottom: 60,
    });
  });
});

describe('placePrompt', () => {
  it('centres the prompt under the selection', () => {
    expect(placePrompt(input(box([400, 200, 200, 100])))).toEqual({
      left: 350,
      top: 300 + PROMPT_GAP_PX,
    });
  });

  it('keeps inside the container’s margins', () => {
    expect(placePrompt(input(box([0, 100, 40, 40])))?.left).toBe(PROMPT_MARGIN_PX);
    expect(placePrompt(input(box([960, 100, 40, 40])))?.left).toBe(
      CONTAINER.width - PROMPT_MARGIN_PX - PROMPT.width,
    );
  });

  it('goes above the selection when there is no room below', () => {
    expect(placePrompt(input(box([400, 600, 200, 80])))).toEqual({
      left: 350,
      top: 600 - PROMPT_GAP_PX - PROMPT.height,
    });
  });

  it('moves to the selection’s side instead of covering the inspector', () => {
    const at = placePrompt(input(box([700, 150, 120, 60]), [TOOLBAR, INSPECTOR, ZOOM]));
    expect(at).toEqual({ left: 700 - PROMPT_GAP_PX - PROMPT.width, top: 159 });
  });

  it('slides along the row under the selection when its sides are taken', () => {
    const left = box([0, 150, 380, 60]);
    const right = box([620, 150, 380, 60]);
    const over = box([380, 80, 240, 60]);
    const under = box([380, 262, 240, 40]);
    const at = placePrompt(input(box([400, 150, 200, 60]), [left, right, over, under]));
    expect(at).toEqual({ left: 380 - PROMPT_GAP_PX - PROMPT.width, top: 222 });
  });

  it('never covers the toolbar', () => {
    const at = placePrompt(input(box([20, 0, 100, 10]), [TOOLBAR]));
    expect(at).not.toBeNull();
    const placed = box([at?.left ?? 0, at?.top ?? 0, PROMPT.width, PROMPT.height]);
    expect(placed.left >= TOOLBAR.right || placed.top >= TOOLBAR.bottom).toBe(true);
  });

  it('sits inside the bottom of a selection that fills the canvas', () => {
    expect(placePrompt(input(box([0, 0, 1000, 700])))).toEqual({
      left: 350,
      top: 700 - PROMPT_MARGIN_PX - PROMPT_GAP_PX - PROMPT.height,
    });
  });

  it('keeps off the next shape below, beside the selection instead', () => {
    const selection = box([400, 200, 200, 40]);
    const next = box([400, 260, 200, 40]);
    const previous = box([400, 140, 200, 40]);
    expect(placePrompt({ ...input(selection), avoid: [next, previous] })).toEqual({
      left: 600 + PROMPT_GAP_PX,
      top: 199,
    });
  });

  it('ignores a frame around the selection, and covers shapes when nothing else fits', () => {
    const frame = box([300, 100, 400, 300]);
    expect(placePrompt({ ...input(box([400, 200, 200, 100])), avoid: [frame] })).toEqual({
      left: 350,
      top: 300 + PROMPT_GAP_PX,
    });
    const everywhere = [
      box([0, 0, 390, 700]),
      box([610, 0, 390, 700]),
      box([390, 0, 220, 190]),
      box([390, 310, 220, 390]),
    ];
    expect(placePrompt({ ...input(box([400, 200, 200, 100])), avoid: everywhere })).toEqual({
      left: 350,
      top: 300 + PROMPT_GAP_PX,
    });
  });

  it('hides when the selection is off screen', () => {
    expect(placePrompt(input(box([-400, 100, 100, 100])))).toBeNull();
    expect(placePrompt(input(box([100, 800, 100, 100])))).toBeNull();
  });

  it('hides when every spot would cover chrome', () => {
    const wall = box([0, 0, 1000, 700]);
    expect(placePrompt(input(box([400, 200, 100, 100]), [wall]))).toBeNull();
  });
});
