// The proposal overlay on a visual editor (PRD §4.2). The host provides the marks of the open
// proposal, keyed by the editor model's ids (which are the React Flow ids); `EditorCanvas` adds
// the classes to every React Flow editor, and an editor that draws its own SVG reads
// `useReviewMark(id)`.
import { cn } from '@nautink/ui/lib/utils';
import { createContext, useContext } from 'react';

import type { ReviewMark, ReviewTarget } from '@nautink/editors/review/review-element';
import type { Context } from 'react';

/** Editor model id → its mark in the open proposal. */
export type ReviewMarks = ReadonlyMap<string, ReviewMark>;

const NO_MARKS: ReviewMarks = new Map<string, ReviewMark>();

/** The marks of the proposal the editor shows; empty when there is none. */
export const ReviewMarksContext: Context<ReviewMarks> = createContext<ReviewMarks>(NO_MARKS);

/** The marks of `targets`, by model id. */
export function reviewMarksOf(targets: readonly ReviewTarget[]): ReviewMarks {
  return targets.length === 0
    ? NO_MARKS
    : new Map<string, ReviewMark>(targets.map((target) => [target.id, target.mark]));
}

/** The mark of one element, or `null`. */
export function useReviewMark(id: string): ReviewMark | null {
  return useContext(ReviewMarksContext).get(id) ?? null;
}

// Each class list starts with a plain `review-<mark>` class, so tests and styles can find marks.

/** React Flow node wrappers: an outline, the "edited" tag, or a struck-through ghost. */
export const NODE_MARK_CLASSES: Readonly<Record<ReviewMark, string>> = {
  added: 'review-added rounded-control outline-2 outline-offset-2 outline-success outline-dashed',
  changed:
    "review-changed rounded-control outline-2 outline-offset-2 outline-accent-ink outline-solid after:absolute after:-top-5 after:right-0 after:rounded-[4px] after:bg-accent-wash after:px-[5px] after:py-px after:font-mono after:text-[10px] after:font-medium after:text-accent-ink after:content-['edited']",
  removed:
    'review-removed rounded-control opacity-60 outline-2 outline-offset-2 outline-destructive outline-dashed [&_*]:line-through',
};

/** React Flow edge groups: the path's color and dash. */
export const EDGE_MARK_CLASSES: Readonly<Record<ReviewMark, string>> = {
  added: 'review-added [&_path]:stroke-success! [&_path]:[stroke-dasharray:6_4]',
  changed: 'review-changed [&_path]:stroke-accent-ink! [&_path]:[stroke-width:2.5px]!',
  removed: 'review-removed opacity-70 [&_path]:stroke-destructive! [&_path]:[stroke-dasharray:4_4]',
};

/**
 * SVG groups of an editor that draws its own diagram (sequence). Transparent hit areas
 * (`stroke-transparent`, `data-hit`) keep their look.
 */
export const SVG_MARK_CLASSES: Readonly<Record<ReviewMark, string>> = {
  added:
    'review-added [&_:is(rect,path,line,polygon):not([data-hit],.stroke-transparent)]:stroke-success! [&_:is(rect,path,line,polygon):not([data-hit],.stroke-transparent)]:[stroke-dasharray:5_3]',
  changed:
    'review-changed [&_:is(rect,path,line,polygon):not([data-hit],.stroke-transparent)]:stroke-accent-ink! [&_:is(rect,path,line,polygon):not([data-hit],.stroke-transparent)]:[stroke-width:2px]',
  removed:
    'review-removed opacity-60 [&_:is(rect,path,line,polygon):not([data-hit],.stroke-transparent)]:stroke-destructive! [&_:is(rect,path,line,polygon):not([data-hit],.stroke-transparent)]:[stroke-dasharray:4_4] [&_text]:fill-destructive! [&_text]:line-through',
};

/** Items (nodes or edges) with their mark's class added. Unmarked items are returned as they are. */
export function withReviewClasses<Item extends { id: string; className?: string | undefined }>(
  items: readonly Item[],
  marks: ReviewMarks,
  classes: Readonly<Record<ReviewMark, string>>,
): Item[] {
  if (marks.size === 0) {
    return [...items];
  }
  return items.map((item: Item): Item => {
    const mark: ReviewMark | undefined = marks.get(item.id);
    return mark === undefined ? item : { ...item, className: cn(item.className, classes[mark]) };
  });
}
