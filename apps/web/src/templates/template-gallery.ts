import { TEMPLATES } from './template-data.ts';

import type { DiagramTemplate, TemplateCategory } from './template-data.ts';
import type { NewDiagramDraft } from '../workspace/workspace-state.ts';

/** A gallery filter: every type, the visual editor types, or one category. */
export type GalleryFilter = 'All' | 'Visual editor' | TemplateCategory;

/** The filters in the gallery's side list, in M6's order. */
export const GALLERY_FILTERS: readonly GalleryFilter[] = [
  'All',
  'Visual editor',
  'Process',
  'Software design',
  'Data',
  'Planning',
  'Charts',
];

/** How a diagram starts: the type's example, or empty. */
export type TemplateStart = 'example' | 'blank';

function matchesFilter(template: DiagramTemplate, filter: GalleryFilter): boolean {
  if (filter === 'All') {
    return true;
  }
  return filter === 'Visual editor' ? template.hasVisualEditor : template.category === filter;
}

function matchesQuery(template: DiagramTemplate, query: string): boolean {
  const needle: string = query.trim().toLowerCase();
  const haystack: string = `${template.name} ${template.description} ${template.category}`;
  return needle === '' || haystack.toLowerCase().includes(needle);
}

/** The templates shown for a filter and a search. */
export function filterTemplates(
  filter: GalleryFilter,
  query: string,
  templates: readonly DiagramTemplate[] = TEMPLATES,
): DiagramTemplate[] {
  return templates.filter((item) => matchesFilter(item, filter) && matchesQuery(item, query));
}

/** How many templates a filter shows, ignoring the search. */
export function filterCount(filter: GalleryFilter): number {
  return filterTemplates(filter, '').length;
}

/** The code a start gives. Throws for a blank start of a type without one. */
export function startCode(template: DiagramTemplate, start: TemplateStart): string {
  if (start === 'example') {
    return template.example;
  }
  if (template.blank === undefined) {
    throw new Error(`The ${template.name} template has no blank start.`);
  }
  return template.blank;
}

/** The new diagram for a start, labelled the way v1 labels it ("New pie chart from example"). */
export function templateDraft(template: DiagramTemplate, start: TemplateStart): NewDiagramDraft {
  const name: string = template.name.toLowerCase();
  const isBlank: boolean = start === 'blank';
  return {
    fields: { code: startCode(template, start), view: isBlank ? 'edit' : 'preview' },
    step: { label: isBlank ? `New blank ${name}` : `New ${name} from example`, source: 'template' },
  };
}
