import { describe, expect, it } from 'vitest';

import { dayLabel, groupByDay, versionText } from './version-text.ts';
import { changedDiagramId, versionCountLabel } from './versions-store.ts';

import type { Version } from '@nautink/storage/records';

const NOW = new Date(2026, 9, 9, 12, 0).getTime();
const HOUR = 3_600_000;

function version(fields: Partial<Version>): Version {
  return {
    id: 'v',
    diagramId: 'd',
    code: '',
    createdAt: NOW,
    kind: 'manual',
    label: '',
    prompt: '',
    ...fields,
  };
}

describe('versionText', () => {
  it('prefers the name, then the prompt, then the kind', () => {
    expect(versionText(version({ label: 'Draft', prompt: 'Add x' }))).toBe('Draft');
    expect(versionText(version({ kind: 'claude', prompt: 'Add x' }))).toBe('Add x');
    expect(versionText(version({ kind: 'restore' }))).toBe('Code before a restore');
    expect(versionText(version({}))).toBe('Unnamed version');
  });
});

describe('day headings', () => {
  it('names today, yesterday, then the date', () => {
    expect(dayLabel(NOW - HOUR, NOW)).toBe('Today');
    expect(dayLabel(NOW - 24 * HOUR, NOW)).toBe('Yesterday');
    expect(dayLabel(new Date(2026, 9, 2).getTime(), NOW)).toBe('Oct 2, 2026');
  });

  it('groups newest-first versions into runs of one day', () => {
    const groups = groupByDay(
      [
        version({ id: 'a', createdAt: NOW }),
        version({ id: 'b', createdAt: NOW - HOUR }),
        version({ id: 'c', createdAt: NOW - 24 * HOUR }),
      ],
      NOW,
    );
    expect(groups.map((group) => [group.label, group.versions.map((item) => item.id)])).toEqual([
      ['Today', ['a', 'b']],
      ['Yesterday', ['c']],
    ]);
  });
});

describe('versions store helpers', () => {
  it('reads the diagram id of a versions-changed event', () => {
    const event = new CustomEvent('nautink:versions-changed', { detail: { diagramId: 'd1' } });
    expect(changedDiagramId(event)).toBe('d1');
    expect(changedDiagramId(new Event('x'))).toBe('');
    expect(changedDiagramId(new CustomEvent('x', { detail: { diagramId: 3 } }))).toBe('');
  });

  it('counts versions in words', () => {
    expect(versionCountLabel(1)).toBe('1 version');
    expect(versionCountLabel(12)).toBe('12 versions');
  });
});
