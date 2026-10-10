// Where the floating selection prompt goes (M1): under the selection when there is room, never over
// the canvas chrome (toolbar, inspector, library, zoom bar, prompt bar), and off the diagram's other
// shapes when it can be. Pure, in container pixels.

/** A rectangle in the canvas container's pixels. */
export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface Size {
  width: number;
  height: number;
}

/** The prompt's top-left corner in the container. */
export interface Placement {
  left: number;
  top: number;
}

export interface PlacementInput {
  /** The selection's bounds. */
  target: Box;
  container: Size;
  prompt: Size;
  /** Chrome the prompt must not cover. */
  obstacles: readonly Box[];
  /**
   * The diagram's other shapes: covered only when no spot leaves them free. Shapes that overlap
   * the selection (a frame around it) are ignored.
   */
  avoid?: readonly Box[];
}

/** Space between the selection (or a piece of chrome) and the prompt. */
export const PROMPT_GAP_PX: number = 12;
/** The closest the prompt comes to the container's edges. */
export const PROMPT_MARGIN_PX: number = 8;

const HALF: number = 0.5;

/** The smallest box around `boxes`, or null for none. */
export function unionBox(boxes: readonly Box[]): Box | null {
  const [first, ...rest] = boxes;
  if (first === undefined) {
    return null;
  }
  return rest.reduce(
    (all: Box, box: Box): Box => ({
      left: Math.min(all.left, box.left),
      top: Math.min(all.top, box.top),
      right: Math.max(all.right, box.right),
      bottom: Math.max(all.bottom, box.bottom),
    }),
    first,
  );
}

function overlaps(a: Box, b: Box): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}

function boxAt(at: Placement, prompt: Size): Box {
  return {
    left: at.left,
    top: at.top,
    right: at.left + prompt.width,
    bottom: at.top + prompt.height,
  };
}

function fits(at: Placement, input: PlacementInput): boolean {
  const box: Box = boxAt(at, input.prompt);
  const isInside: boolean =
    box.left >= PROMPT_MARGIN_PX - 1 &&
    box.top >= PROMPT_MARGIN_PX - 1 &&
    box.right <= input.container.width - PROMPT_MARGIN_PX + 1 &&
    box.bottom <= input.container.height - PROMPT_MARGIN_PX + 1;
  return isInside && !input.obstacles.some((obstacle) => overlaps(box, obstacle));
}

function clampLeft(left: number, input: PlacementInput): number {
  const highest: number = input.container.width - PROMPT_MARGIN_PX - input.prompt.width;
  return clamp(left, PROMPT_MARGIN_PX, Math.max(PROMPT_MARGIN_PX, highest));
}

function centredLeft(input: PlacementInput): number {
  const { target, prompt } = input;
  return clampLeft((target.left + target.right - prompt.width) * HALF, input);
}

/** Spots on one row beside each obstacle a centred prompt would cover. */
function besideSpots(top: number, input: PlacementInput): Placement[] {
  const row: Box = boxAt({ left: centredLeft(input), top }, input.prompt);
  return input.obstacles
    .filter((obstacle) => overlaps(row, obstacle))
    .flatMap((obstacle) => [
      obstacle.left - PROMPT_GAP_PX - input.prompt.width,
      obstacle.right + PROMPT_GAP_PX,
    ])
    .map((left) => ({ left: clampLeft(left, input), top }));
}

/**
 * Spots in order of preference: centred under the selection, centred above it, to its right, to
 * its left, then along those rows beside whatever is in the way, then inside the bottom of its
 * visible part.
 */
function candidates(input: PlacementInput): Placement[] {
  const { target, prompt, container } = input;
  const below: number = target.bottom + PROMPT_GAP_PX;
  const above: number = target.top - PROMPT_GAP_PX - prompt.height;
  const middle: number = (target.top + target.bottom - prompt.height) * HALF;
  const inside: number =
    Math.min(target.bottom, container.height - PROMPT_MARGIN_PX) - PROMPT_GAP_PX - prompt.height;
  const centred: number = centredLeft(input);
  return [
    { left: centred, top: below },
    { left: centred, top: above },
    { left: target.right + PROMPT_GAP_PX, top: middle },
    { left: target.left - PROMPT_GAP_PX - prompt.width, top: middle },
    ...besideSpots(below, input),
    ...besideSpots(above, input),
    { left: centred, top: inside },
    ...besideSpots(inside, input),
  ];
}

function firstFit(input: PlacementInput): Placement | null {
  return candidates(input).find((spot) => fits(spot, input)) ?? null;
}

function isOnScreen(target: Box, container: Size): boolean {
  return overlaps(target, { left: 0, top: 0, right: container.width, bottom: container.height });
}

/**
 * The prompt's spot, or null when the selection is off screen or there is no room that leaves the
 * chrome uncovered (the prompt then hides). Spots that also leave the other shapes free come first.
 */
export function placePrompt(input: PlacementInput): Placement | null {
  if (!isOnScreen(input.target, input.container)) {
    return null;
  }
  const shapes: Box[] = (input.avoid ?? []).filter((shape) => !overlaps(shape, input.target));
  return firstFit({ ...input, obstacles: [...input.obstacles, ...shapes] }) ?? firstFit(input);
}
