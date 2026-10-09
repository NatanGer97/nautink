import { describe, expect, it } from 'vitest';

import { TEMPLATES } from './template-data.ts';
import { filterCount, filterTemplates, startCode, templateDraft } from './template-gallery.ts';
import { initMermaid } from '../mermaid/mermaid-instance.ts';
import { validateMermaid } from '../mermaid/validate.ts';

const STARTERS = TEMPLATES.flatMap((template) => [
  { name: `${template.name} example`, code: template.example },
  ...(template.blank === undefined
    ? []
    : [{ name: `${template.name} blank`, code: template.blank }]),
]);

describe('template data', () => {
  it('has v1’s 14 types and 19 starters, a blank for each visual editor type', () => {
    expect(TEMPLATES).toHaveLength(14);
    expect(STARTERS).toHaveLength(19);
    expect(new Set(TEMPLATES.map((template) => template.id)).size).toBe(14);
    for (const template of TEMPLATES) {
      expect(template.blank !== undefined).toBe(template.hasVisualEditor);
    }
  });

  it.each(STARTERS)('$name parses', async ({ code }) => {
    await initMermaid(false);
    expect(await validateMermaid(code)).toBeNull();
  });
});

describe('gallery model', () => {
  it('filters by category, by visual editor, and by search', () => {
    expect(filterCount('All')).toBe(14);
    expect(filterCount('Visual editor')).toBe(5);
    expect(filterTemplates('Charts', '').map((template) => template.id)).toEqual([
      'pie',
      'quadrant',
    ]);
    expect(filterTemplates('All', 'SCHEDULE').map((template) => template.id)).toEqual(['gantt']);
    expect(filterTemplates('Data', 'pie')).toEqual([]);
  });

  it('labels new diagrams the way v1 does and opens blanks in the editor', () => {
    const [flowchart] = filterTemplates('All', 'flowchart');
    expect(templateDraft(flowchart!, 'example')).toEqual({
      fields: { code: flowchart!.example, view: 'preview' },
      step: { label: 'New flowchart from example', source: 'template' },
    });
    expect(templateDraft(flowchart!, 'blank')).toEqual({
      fields: { code: 'flowchart TD\n', view: 'edit' },
      step: { label: 'New blank flowchart', source: 'template' },
    });
  });

  it('throws for a blank start of a code-only type', () => {
    const [pie] = filterTemplates('Charts', 'pie');
    expect(() => startCode(pie!, 'blank')).toThrow('The Pie chart template has no blank start.');
  });
});
