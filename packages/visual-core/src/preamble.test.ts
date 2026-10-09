import { describe, expect, it } from 'vitest';

import { splitPreamble } from './preamble.ts';

describe('splitPreamble', () => {
  it('returns the whole code as body when there is no preamble', () => {
    expect(splitPreamble('flowchart TD\n')).toEqual({ preamble: '', body: 'flowchart TD\n' });
  });

  it('splits front matter and init directives', () => {
    const code = '---\ntitle: Hi\n---\n%%{init: {"theme": "dark"}}%%\n  %%{wrap}%%\nflowchart TD\n';
    expect(splitPreamble(code)).toEqual({
      preamble: '---\ntitle: Hi\n---\n%%{init: {"theme": "dark"}}%%\n%%{wrap}%%\n',
      body: 'flowchart TD\n',
    });
  });

  it('keeps plain comments in the body', () => {
    expect(splitPreamble('%% hi\nflowchart TD').preamble).toBe('');
  });
});
