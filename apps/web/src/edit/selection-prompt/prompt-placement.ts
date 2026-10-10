// Where the floating selection prompt goes (M1): under the selection, or above it, never over the
// canvas chrome (toolbar, inspector, library, zoom bar, prompt bar). Pure, in container pixels.

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

/** Lefts to try on one row: centred on the selection, then beside each piece of chrome in the way. */
function leftsFor(top: number, input: PlacementInput): number[] {
  const { target, prompt } = input;
  const centred: number = clampLeft((target.left + target.right - prompt.width) * HALF, input);
  const row: Box = boxAt({ left: centred, top }, prompt);
  const beside: number[] = input.obstacles
    .filter((obstacle) => overlaps(row, obstacle))
    .flatMap((obstacle) => [
      obstacle.left - PROMPT_GAP_PX - prompt.width,
      obstacle.right + PROMPT_GAP_PX,
    ]);
  return [centred, ...beside.map((left) => clampLeft(left, input))];
}

/** Tops to try: under the selection, above it, then inside the bottom of its visible part. */
function topsFor(input: PlacementInput): number[] {
  const { target, prompt, container } = input;
  const visibleBottom: number = Math.min(target.bottom, container.height - PROMPT_MARGIN_PX);
  return [
    target.bottom + PROMPT_GAP_PX,
    target.top - PROMPT_GAP_PX - prompt.height,
    visibleBottom - PROMPT_GAP_PX - prompt.height,
  ];
}

function isOnScreen(target: Box, container: Size): boolean {
  return overlaps(target, { left: 0, top: 0, right: container.width, bottom: container.height });
}

/**
 * The prompt's spot, or null when the selection is off screen or there is no room that leaves the
 * chrome uncovered (the prompt then hides).
 */
export function placePrompt(input: PlacementInput): Placement | null {
  if (!isOnScreen(input.target, input.container)) {
    return null;
  }
  for (const top of topsFor(input)) {
    const left: number | undefined = leftsFor(top, input).find((x) =>
      fits({ left: x, top }, input),
    );
    if (left !== undefined) {
      return { left, top };
    }
  }
  return null;
}
