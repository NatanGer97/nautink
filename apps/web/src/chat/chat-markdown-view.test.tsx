import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ChatMarkdown } from './chat-markdown-view.tsx';

describe('ChatMarkdown', () => {
  it('draws bold, code, lists and safe links, and never raw HTML', () => {
    const { container } = render(
      <ChatMarkdown
        text={
          'I renamed **Pay** to `Charge`.\n\n- a\n- b\n\n1. c\n\n[docs](https://x.dev)\n\n<img src=x onerror=alert(1)>\n\n# Head\n\n```\ncode\n```'
        }
      />,
    );
    expect(screen.getByText('Pay').tagName).toBe('STRONG');
    expect(screen.getByText('Charge').tagName).toBe('CODE');
    expect(container.querySelectorAll('ul li')).toHaveLength(2);
    expect(container.querySelectorAll('ol li')).toHaveLength(1);
    const link = screen.getByRole('link', { name: 'docs' });
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeTruthy();
    expect(screen.getByText('Head').className).toContain('font-semibold');
    expect(container.querySelector('pre code')?.textContent).toBe('code');
  });
});
