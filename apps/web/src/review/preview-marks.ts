// The proposal overlay on Mermaid's own render (PRD §4.2): each marked element of the review is
// found in the SVG by the ids Mermaid gives it, and carries `data-review="added|changed|removed"`.
import { useLayoutEffect } from 'react';

import { idsOf } from '../preview/locate.ts';

import type { ReviewMark, ReviewTarget } from '@nautink/editors/review/review-element';
import type { EditorId } from '@nautink/visual-core/editor-contract';
import type { RefObject } from 'react';

/** Marks a rendered element with its review mark. */
export const REVIEW_ATTRIBUTE: string = 'data-review';

/** The "edited" tag drawn on a changed shape. */
const TAG_ATTRIBUTE: string = 'data-review-tag';
const TAG_WIDTH: number = 44;
const TAG_HEIGHT: number = 16;
const TAG_GAP: number = 4;
const TAG_TEXT_X: number = 22;
const TAG_TEXT_Y: number = 11.5;

/** What the stage marks: the diagram type (Mermaid names elements per type) and the targets. */
export interface PreviewReview {
  editor: EditorId;
  targets: readonly ReviewTarget[];
}

/**
 * The stage's Tailwind classes for the marks. Important: Mermaid styles its shapes with id
 * selectors, which a class cannot outweigh. Diff colors differ in lightness too (PRD §6.1), and
 * added and removed also differ in dash and strike-through, so hue is never the only signal.
 */
export const REVIEW_STAGE_CLASS: string = [
  '[&_[data-review=added]_:is(rect,polygon,circle,ellipse,path,line)]:stroke-success!',
  '[&_:is(path,line,rect)[data-review=added]]:stroke-success!',
  '[&_[data-review=added]_:is(rect,polygon,circle,ellipse,path,line)]:[stroke-dasharray:5_3]!',
  '[&_:is(path,line,rect)[data-review=added]]:[stroke-dasharray:5_3]!',
  '[&_g[data-review=added]_:is(rect,polygon,circle,ellipse)]:fill-success-bg!',
  '[&_[data-review=changed]_:is(rect,polygon,circle,ellipse,path,line)]:stroke-accent-ink!',
  '[&_:is(path,line,rect)[data-review=changed]]:stroke-accent-ink!',
  '[&_[data-review=changed]_:is(rect,polygon,circle,ellipse,path,line)]:[stroke-width:2px]!',
  '[&_:is(path,line,rect)[data-review=changed]]:[stroke-width:2px]!',
  '[&_[data-review=removed]_:is(rect,polygon,circle,ellipse,path,line)]:stroke-destructive!',
  '[&_:is(path,line,rect)[data-review=removed]]:stroke-destructive!',
  '[&_[data-review=removed]_:is(rect,polygon,circle,ellipse,path,line)]:[stroke-dasharray:4_4]!',
  '[&_:is(path,line,rect)[data-review=removed]]:[stroke-dasharray:4_4]!',
  '[&_[data-review=removed]]:opacity-70',
  '[&_[data-review=removed]_:is(span,p,div)]:text-destructive! [&_[data-review=removed]_:is(span,p,div)]:line-through',
  '[&_:is(text,tspan)[data-review=removed]]:fill-destructive! [&_:is(text,tspan)[data-review=removed]]:line-through',
  '[&_[data-review=removed]_:is(text,tspan)]:fill-destructive! [&_[data-review=removed]_:is(text,tspan)]:line-through',
].join(' ');

type Finder = (stage: Element, target: ReviewTarget) => Element[];

function byDataId(stage: Element, test: (dataId: string) => boolean): Element[] {
  return [...stage.querySelectorAll('[data-id]')].filter((element: Element) =>
    test(element.getAttribute('data-id') ?? ''),
  );
}

function byNodeId(stage: Element, id: string): Element[] {
  return [...stage.querySelectorAll('g[id]')].filter(
    (group: Element) => group.classList.contains('node') && idsOf(group).includes(id),
  );
}

function byIdSuffix(stage: Element, selector: string, suffix: string): Element[] {
  return [...stage.querySelectorAll(selector)].filter((element: Element) =>
    element.id.endsWith(suffix),
  );
}

function edgeFinder(editor: EditorId): Finder {
  return (stage: Element, target: ReviewTarget): Element[] => {
    const [from, to] = target.ends ?? ['', ''];
    switch (editor) {
      case 'class':
        return byDataId(stage, (id) =>
          new RegExp(`^id_${escaped(from)}_${escaped(to)}_\\d+$`).test(id),
        );
      case 'er':
        return byDataId(stage, (id) =>
          new RegExp(`^id_entity-${escaped(from)}-\\d+_entity-${escaped(to)}-\\d+_\\d+$`).test(id),
        );
      case 'state':
        return byDataId(stage, (id) => id === `edge${String(target.order)}`);
      default:
        return byDataId(stage, (id) => id === target.id);
    }
  };
}

function escaped(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function noteFinder(editor: EditorId): Finder {
  return (stage: Element, target: ReviewTarget): Element[] => {
    if (editor === 'class') {
      return byIdSuffix(stage, 'g[id]', `-note${String(target.order)}`);
    }
    const owner: string = target.key.slice(target.key.indexOf(':') + 1);
    return [...stage.querySelectorAll('g[id]')].filter((group: Element) =>
      group.id.includes(`-state-${owner}----note-`),
    );
  };
}

/** The n-th message's text and line: Mermaid draws messages in source order. */
function messageFinder(stage: Element, target: ReviewTarget): Element[] {
  const texts: Element[] = [...stage.querySelectorAll('.messageText')];
  const lines: Element[] = [...stage.querySelectorAll('.messageLine0, .messageLine1')];
  return [texts[target.order], lines[target.order]].flatMap((element) =>
    element === undefined ? [] : [element],
  );
}

function participantFinder(stage: Element, target: ReviewTarget): Element[] {
  return [...stage.querySelectorAll('[name]')].filter(
    (element: Element) => element.getAttribute('name') === target.id && element.tagName !== 'line',
  );
}

function finderFor(editor: EditorId, target: ReviewTarget): Finder {
  switch (target.kind) {
    case 'edge':
      return edgeFinder(editor);
    case 'note':
      return noteFinder(editor);
    case 'group':
      return (stage) => byIdSuffix(stage, 'g.cluster', `-${target.id}`);
    case 'message':
      return messageFinder;
    case 'participant':
      return participantFinder;
    default:
      return (stage) => byNodeId(stage, target.id);
  }
}

/**
 * Draws an "edited" tag over the top-right corner of a changed shape, when it can be measured.
 * The tag is a sibling placed like the shape, so the shape's marks never style it.
 */
function addTag(group: Element): void {
  if (!(group instanceof SVGGraphicsElement) || typeof group.getBBox !== 'function') {
    return;
  }
  const box: DOMRect = group.getBBox();
  const x: string = String(box.x + box.width - TAG_WIDTH);
  const y: string = String(box.y - TAG_HEIGHT - TAG_GAP);
  const place: string = group.getAttribute('transform') ?? '';
  group.insertAdjacentHTML(
    'afterend',
    `<g ${TAG_ATTRIBUTE} transform="${place} translate(${x} ${y})"><rect width="${String(TAG_WIDTH)}" height="${String(TAG_HEIGHT)}" rx="4" class="fill-accent-wash! stroke-none!"></rect><text x="${String(TAG_TEXT_X)}" y="${String(TAG_TEXT_Y)}" text-anchor="middle" class="fill-accent-ink! font-mono text-[10px] font-medium">edited</text></g>`,
  );
}

function clearMarks(stage: Element): void {
  for (const element of stage.querySelectorAll(`[${REVIEW_ATTRIBUTE}]`)) {
    element.removeAttribute(REVIEW_ATTRIBUTE);
  }
  for (const tag of stage.querySelectorAll(`[${TAG_ATTRIBUTE}]`)) {
    tag.remove();
  }
}

function mark(elements: readonly Element[], target: ReviewTarget): number {
  const value: ReviewMark = target.mark;
  for (const element of elements) {
    element.setAttribute(REVIEW_ATTRIBUTE, value);
  }
  if (value === 'changed' && target.kind === 'node') {
    elements.forEach(addTag);
  }
  return elements.length;
}

/** Marks the review's elements in the rendered SVG and clears old marks. Returns the marked count. */
export function markReviewShapes(stage: Element, review: PreviewReview | null): number {
  clearMarks(stage);
  if (review === null) {
    return 0;
  }
  return review.targets.reduce(
    (count: number, target: ReviewTarget) =>
      count + mark(finderFor(review.editor, target)(stage, target), target),
    0,
  );
}

/** Keeps the review marks on the rendered SVG in step with the proposal and each new render. */
export function usePreviewReviewMarks(
  stageRef: RefObject<HTMLElement | null>,
  svg: string,
  review: PreviewReview | null,
): void {
  useLayoutEffect(() => {
    const stage: HTMLElement | null = stageRef.current;
    if (stage !== null) {
      markReviewShapes(stage, review);
    }
  }, [stageRef, svg, review]);
}
