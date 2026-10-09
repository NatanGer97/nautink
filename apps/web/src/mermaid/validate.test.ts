import { describe, expect, it } from 'vitest';

import { initMermaid } from './mermaid-instance.ts';
import { toMermaidError, validateMermaid } from './validate.ts';

describe('toMermaidError', () => {
  it('prefers the parser hash line', () => {
    const err = { message: ' Parse error on line 3 ', hash: { loc: { first_line: 2 } } };
    expect(toMermaidError(err)).toEqual({ message: 'Parse error on line 3', line: 2 });
  });

  it('falls back to the line in the message, then to no line', () => {
    expect(toMermaidError(new Error('Lexical error on line 7.'))).toEqual({
      message: 'Lexical error on line 7.',
      line: 7,
    });
    expect(toMermaidError('No diagram type detected')).toEqual({
      message: 'No diagram type detected',
      line: null,
    });
    expect(toMermaidError(null)).toEqual({ message: 'null', line: null });
  });
});

describe('validateMermaid', () => {
  it('returns null for valid code and an error with a line for invalid code', async () => {
    await initMermaid(false);
    expect(await validateMermaid('flowchart TD\n  A --> B')).toBeNull();
    const error = await validateMermaid('flowchart TD\n  A -->');
    expect(error?.message).toMatch(/error/i);
    expect(error?.line).toBe(2);
  });
});
