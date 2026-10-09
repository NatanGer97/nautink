// Locks visual-core's diagram type detection to v1's `detectType` on every v1 template.
import { detectType } from '@nautink/visual-core/detect';
import { describe, expect, it } from 'vitest';

import golden from '../../tests/golden/detect.json' with { type: 'json' };

import type { DetectedType } from '@nautink/visual-core/detect';

interface DetectCase {
  name: string;
  code: string;
  expected: DetectedType;
}

const CASES: DetectCase[] = golden.cases.map((entry) => ({
  ...entry,
  expected: { ...entry.expected, editor: entry.expected.editor as DetectedType['editor'] },
}));

describe('detectType matches v1', () => {
  it.each(CASES)('$name', ({ code, expected }: DetectCase) => {
    expect(detectType(code)).toEqual(expected);
  });
});
