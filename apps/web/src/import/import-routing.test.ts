import { describe, expect, it } from 'vitest';

import { countsMessage, parseBackupText, routeImport } from './import-routing.ts';

describe('routeImport', () => {
  it('makes diagrams from Mermaid and Markdown, restores JSON and skips the rest', () => {
    const route = routeImport([
      { name: 'checkout.mmd', text: 'flowchart TD\n  a --> b\n' },
      {
        name: 'notes.md',
        text: '# Notes\n```mermaid\npie title A\n```\ntext\n```mermaid\nflowchart LR\n```\n',
      },
      { name: 'backup.json', text: '{}' },
      { name: 'photo.png', text: '' },
    ]);
    expect(route.drafts.map((draft) => draft.fields.title)).toEqual([
      'checkout',
      'notes 1',
      'notes 2',
    ]);
    expect(route.drafts[0]?.step).toEqual({ label: 'Imported “checkout”', source: 'import' });
    expect(route.backups.map((file) => file.name)).toEqual(['backup.json']);
    expect(route.skipped).toEqual(['photo.png']);
  });

  it('labels a diagram without a title as a file', () => {
    const [draft] = routeImport([{ name: '.mmd', text: 'pie' }]).drafts;
    expect(draft?.step.label).toBe('Imported “file”');
  });
});

describe('parseBackupText', () => {
  it('parses JSON and names the file when it is not JSON', () => {
    expect(parseBackupText({ name: 'a.json', text: '{"x":1}' })).toEqual({ x: 1 });
    expect(() => parseBackupText({ name: 'a.json', text: 'nope' })).toThrow(
      'a.json is not valid JSON.',
    );
  });
});

describe('countsMessage', () => {
  it('counts diagrams and versions in words', () => {
    expect(countsMessage('Imported', { diagrams: 1 })).toBe('Imported 1 diagram');
    expect(countsMessage('Restored', { diagrams: 2, versions: 1 })).toBe(
      'Restored 2 diagrams and 1 version',
    );
  });
});
