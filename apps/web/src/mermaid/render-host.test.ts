import { afterEach, describe, expect, it } from 'vitest';

import { mermaidRenderHost } from './render-host.ts';

afterEach(() => {
  document.body.replaceChildren();
});

describe('mermaidRenderHost', () => {
  it('is a hidden, fixed element that cannot change the page size', () => {
    const host = mermaidRenderHost();
    expect(host.parentElement).toBe(document.body);
    expect(host.getAttribute('aria-hidden')).toBe('true');
    expect(host.style.position).toBe('fixed');
    expect(host.style.visibility).toBe('hidden');
  });

  it('is made once and reused', () => {
    expect(mermaidRenderHost()).toBe(mermaidRenderHost());
    expect(document.querySelectorAll('#nautink-mermaid-host')).toHaveLength(1);
  });
});
