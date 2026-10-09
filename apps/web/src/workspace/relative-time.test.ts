import { describe, expect, it } from 'vitest';

import { relativeTime } from './relative-time.ts';
import { clip, displayTitle, lineCount } from './text.ts';

const NOW = new Date(2026, 9, 9, 12, 0, 0).getTime();
const MINUTE = 60_000;

describe('relativeTime', () => {
  it('reads like v1, from just now to a date', () => {
    expect(relativeTime(NOW - 10_000, NOW)).toBe('just now');
    expect(relativeTime(NOW + 5000, NOW)).toBe('just now');
    expect(relativeTime(NOW - 50_000, NOW)).toBe('1 min ago');
    expect(relativeTime(NOW - 3 * MINUTE, NOW)).toBe('3 min ago');
    expect(relativeTime(NOW - 120 * MINUTE, NOW)).toBe('2 h ago');
    expect(relativeTime(NOW - 26 * 60 * MINUTE, NOW)).toBe('Yesterday');
    expect(relativeTime(NOW - 4 * 24 * 60 * MINUTE, NOW)).toBe('4 days ago');
    expect(relativeTime(new Date(2026, 9, 2).getTime(), NOW)).toBe('Oct 2');
    expect(relativeTime(new Date(2025, 9, 2).getTime(), NOW)).toBe('Oct 2, 2025');
  });
});

describe('text helpers', () => {
  it('clips long labels to one line', () => {
    expect(clip('  a\n  b  ')).toBe('a b');
    expect(clip('abcdefghij', 5)).toBe('abcd…');
  });

  it('counts lines without the trailing newline', () => {
    expect(lineCount('')).toBe(0);
    expect(lineCount('flowchart TD\n')).toBe(1);
    expect(lineCount('a\nb')).toBe(2);
  });

  it('names an untitled diagram', () => {
    expect(displayTitle(' ')).toBe('Untitled');
    expect(displayTitle('Checkout')).toBe('Checkout');
  });
});
