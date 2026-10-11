import { describe, expect, it } from 'vitest';

import { fileSlug, readDiagramFiles } from './diagram-files.ts';

describe('readDiagramFiles', () => {
  it('reads one diagram per .mmd or .mermaid file, titled by file name', () => {
    const result = readDiagramFiles([
      { name: 'login-flow.mmd', text: 'flowchart TD\r\n  A --> B\r\n' },
      { name: 'Pets.MERMAID', text: 'pie\n  "Dogs": 3' },
    ]);
    expect(result).toEqual({
      drafts: [
        { code: 'flowchart TD\n  A --> B\n', title: 'login-flow', titleAuto: false },
        { code: 'pie\n  "Dogs": 3', title: 'Pets', titleAuto: false },
      ],
      skipped: [],
      backups: [],
    });
  });

  it('uses a front matter title and keeps it automatic', () => {
    const code = '---\ntitle: Checkout\n---\nflowchart TD';
    expect(readDiagramFiles([{ name: 'x.mmd', text: code }]).drafts).toEqual([
      { code, title: 'Checkout', titleAuto: true },
    ]);
  });

  it('skips empty mermaid files and unknown extensions', () => {
    const result = readDiagramFiles([
      { name: 'empty.mmd', text: '  \n' },
      { name: 'notes.txt', text: 'flowchart TD' },
      { name: 'README', text: '' },
    ]);
    expect(result.drafts).toEqual([]);
    expect(result.skipped).toEqual(['empty.mmd', 'notes.txt', 'README']);
  });

  it('hands .json files back as backups', () => {
    const backup = { name: 'backup.JSON', text: '{}' };
    expect(readDiagramFiles([backup])).toEqual({ drafts: [], skipped: [], backups: [backup] });
  });

  it('skips Markdown with no mermaid block', () => {
    const text = '# Notes\n\n```js\nconsole.log(1)\n```\n\n```mermaid\n\n```\n';
    expect(readDiagramFiles([{ name: 'notes.md', text }])).toEqual({
      drafts: [],
      skipped: ['notes.md'],
      backups: [],
    });
  });

  it('reads one Markdown block, titled by file name', () => {
    const text = '# Design\n\n```mermaid\nflowchart TD\n  A --> B\n```\n';
    expect(readDiagramFiles([{ name: 'design.markdown', text }]).drafts).toEqual([
      { code: 'flowchart TD\n  A --> B\n', title: 'design', titleAuto: false },
    ]);
  });

  it('reads many Markdown blocks, numbered, with ~~~ fences too', () => {
    const text = [
      '```mermaid',
      'pie',
      '```',
      'text',
      '~~~ mermaid',
      'gantt',
      '~~~',
      '````mermaid title="x"',
      'graph LR',
      '````',
      '',
    ].join('\r\n');
    expect(readDiagramFiles([{ name: 'arch.md', text }]).drafts).toEqual([
      { code: 'pie\n', title: 'arch 1', titleAuto: false },
      { code: 'gantt\n', title: 'arch 2', titleAuto: false },
      { code: 'graph LR\n', title: 'arch 3', titleAuto: false },
    ]);
  });
});

describe('fileSlug', () => {
  it('makes a safe file name', () => {
    expect(fileSlug('  Login / Signup: flow?  ')).toBe('Login-Signup-flow');
    expect(fileSlug('***')).toBe('diagram');
    expect(fileSlug('')).toBe('diagram');
    expect(fileSlug('a'.repeat(100))).toHaveLength(80);
  });
});
