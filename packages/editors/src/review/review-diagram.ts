// Claude's proposal against the current code, for the five diagram types with a visual editor
// (PRD §4.2): what to show on the canvas, what to mark, and how many changes there are.
import { detectType } from '@nautink/visual-core/detect';

import { classReview } from './class-review.ts';
import { erReview } from './er-review.ts';
import { flowReview } from './flow-review.ts';
import { countChanges, reviewTargets } from './review-element.ts';
import { sequenceReview } from './sequence-review.ts';
import { stateReview } from './state-review.ts';

import type { ReviewAdapter } from './review-adapter.ts';
import type { ReviewCounts, ReviewElement, ReviewTarget } from './review-element.ts';
import type { DiagramLoader, EditorId, ParseResult } from '@nautink/visual-core/editor-contract';

export interface ReviewInput {
  /** The code before Claude's turn. */
  before: string;
  /** The code Claude proposes. */
  after: string;
  load: DiagramLoader;
}

/** A review on the canvas: the code to show and the elements to mark in it. */
export interface StructuralReview {
  kind: 'structural';
  editor: EditorId;
  counts: ReviewCounts;
  /** The proposal with its removed elements added back as ghosts, or the proposal itself. */
  code: string;
  targets: ReviewTarget[];
}

/** Why the proposal can only be reviewed as a code diff. */
export interface CodeOnlyReview {
  kind: 'code';
  reason: string;
}

export type DiagramReview = StructuralReview | CodeOnlyReview;

type Reviewer = (input: ReviewInput) => Promise<DiagramReview>;

async function parsedOr<Model>(
  adapter: ReviewAdapter<Model>,
  code: string,
  load: DiagramLoader,
): Promise<Model> {
  const result: ParseResult<Model> = await adapter.module.parse(code, load);
  return result.kind === 'ok' ? result.model : adapter.module.emptyModel();
}

/** What to show: the merged model when it has ghosts and parses, else the proposal as written. */
async function shownVersion<Model>(
  adapter: ReviewAdapter<Model>,
  models: { before: Model; after: Model; afterCode: string },
  load: DiagramLoader,
): Promise<ShownVersion<Model>> {
  const { before, after, afterCode } = models;
  const hasGhosts: boolean =
    countChanges(adapter.elements(before), adapter.elements(after)).removed > 0;
  const code: string = adapter.module.serialize(adapter.union(before, after));
  const merged: ParseResult<Model> = hasGhosts
    ? await adapter.module.parse(code, load)
    : { kind: 'error', message: 'Nothing was removed.' };
  return merged.kind === 'ok' ? { code, model: merged.model } : { code: afterCode, model: after };
}

interface ShownVersion<Model> {
  code: string;
  model: Model;
}

/** The review of two parsed models: counts against `before`, marks on the shown version. */
async function reviewModels<Model>(
  adapter: ReviewAdapter<Model>,
  models: { before: Model; after: Model; afterCode: string },
  load: DiagramLoader,
): Promise<StructuralReview> {
  const shown: ShownVersion<Model> = await shownVersion(adapter, models, load);
  const versions: { before: ReviewElement[]; after: ReviewElement[] } = {
    before: adapter.elements(models.before),
    after: adapter.elements(models.after),
  };
  return {
    kind: 'structural',
    editor: adapter.module.id,
    counts: countChanges(versions.before, versions.after),
    code: shown.code,
    targets: reviewTargets(adapter.elements(shown.model), versions),
  };
}

function reviewWith<Model>(adapter: ReviewAdapter<Model>): Reviewer {
  return async ({ before, after, load }: ReviewInput): Promise<DiagramReview> => {
    const parsed: ParseResult<Model> = await adapter.module.parse(after, load);
    if (parsed.kind !== 'ok') {
      return { kind: 'code', reason: parsed.message };
    }
    const isSameType: boolean = detectType(before).editor === adapter.module.id;
    const old: Model = isSameType
      ? await parsedOr(adapter, before, load)
      : adapter.module.emptyModel();
    return reviewModels(adapter, { before: old, after: parsed.model, afterCode: after }, load);
  };
}

const REVIEWERS: Readonly<Record<EditorId, Reviewer>> = {
  flow: reviewWith(flowReview),
  class: reviewWith(classReview),
  er: reviewWith(erReview),
  state: reviewWith(stateReview),
  sequence: reviewWith(sequenceReview),
};

/** Reviews `after` against `before`; types without a visual editor are reviewed as code. */
export async function reviewDiagram(input: ReviewInput): Promise<DiagramReview> {
  const editor: EditorId | null = detectType(input.after).editor;
  if (editor === null) {
    return { kind: 'code', reason: 'This diagram type has no visual editor.' };
  }
  return REVIEWERS[editor](input);
}
