import { describe, expect, it } from 'vitest';

import { deleteLabel, editLabel } from './labels.ts';

describe('editLabel', () => {
  it('names a rename', () => {
    expect(editLabel('node', 'Start', { label: 'Begin' })).toBe('Renamed Start → Begin');
  });

  it('names a cleared name', () => {
    expect(editLabel('node', 'Start', { label: '  ' })).toBe('Cleared name of Start');
    expect(editLabel('class', '', { name: 3 })).toBe('Cleared name of class');
  });

  it('says "Labelled" for links', () => {
    expect(editLabel('link', 'a → b', { label: 'yes' })).toBe('Labelled link a → b');
    expect(editLabel('transition', '', { label: 'go' })).toBe('Labelled transition');
  });

  it('uses the phrase for a known field', () => {
    expect(editLabel('node', 'Start', { shape: 'diam' })).toBe('Changed shape of Start');
    expect(editLabel('relationship', '', { isIdentifying: false })).toBe(
      'Changed line of relationship',
    );
  });

  it('falls back to "Edited" for several or unknown fields', () => {
    expect(editLabel('node', 'Start', { shape: 'x', label: 'y' })).toBe('Edited node Start');
    expect(editLabel('node', '', { color: 'red' })).toBe('Edited node');
    expect(editLabel('node', 'A')).toBe('Edited node A');
  });

  it('clips long names', () => {
    expect(editLabel('node', 'x'.repeat(40), { label: 'y'.repeat(40) })).toBe(
      `Renamed ${'x'.repeat(27)}… → ${'y'.repeat(27)}…`,
    );
  });
});

describe('deleteLabel', () => {
  it('names one item, counts several', () => {
    expect(deleteLabel(['Start'])).toBe('Deleted Start');
    expect(deleteLabel(['a', '', 'b', 'c'])).toBe('Deleted 3 items');
  });

  it('falls back when no name is known', () => {
    expect(deleteLabel([])).toBe('Deleted items');
    expect(deleteLabel([''])).toBe('Deleted items');
  });
});
