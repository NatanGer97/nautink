import { describe, expect, it } from 'vitest';

import {
  base64Url,
  embedHtml,
  markdownBlock,
  mermaidLiveState,
  mermaidLiveUrl,
} from './export-formats.ts';

describe('export formats', () => {
  it('wraps the code in a fenced Markdown block', () => {
    expect(markdownBlock('flowchart TD\n  a\n\n')).toBe('```mermaid\nflowchart TD\n  a\n```\n');
  });

  it('builds an HTML embed with escaped code and the theme', () => {
    const html = embedHtml('flowchart TD\n  a --> b & <c>', true);
    expect(html).toContain(
      '<pre class="mermaid">\nflowchart TD\n  a --&gt; b &amp; &lt;c&gt;\n</pre>',
    );
    expect(html).toContain("theme: 'dark'");
    expect(html).toContain('mermaid@12.1.0');
    expect(embedHtml('a', false)).toContain("theme: 'default'");
  });

  it('encodes base64url without padding', () => {
    expect(base64Url(new Uint8Array([251, 255]))).toBe('-_8');
    expect(base64Url(new Uint8Array(0x8001).fill(65))).toHaveLength(43692);
  });

  it('builds the mermaid.live state and a pako link that inflates back to it', async () => {
    const state: unknown = JSON.parse(mermaidLiveState('graph TD', false));
    expect(state).toMatchObject({ code: 'graph TD', autoSync: true, updateDiagram: true });
    const url = await mermaidLiveUrl('graph TD', true);
    expect(url.startsWith('https://mermaid.live/edit#pako:')).toBe(true);
    const encoded = url
      .slice('https://mermaid.live/edit#pako:'.length)
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
    const inflate = new DecompressionStream('deflate');
    const text = new Response(inflate.readable).text();
    const writer = inflate.writable.getWriter();
    await writer.write(bytes);
    await writer.close();
    const inflated = await text;
    expect(JSON.parse(inflated)).toMatchObject({ code: 'graph TD' });
    expect(inflated).toContain('dark');
  });
});
