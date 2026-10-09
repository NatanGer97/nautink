// Text formats for sharing a diagram (v1's `export.js`): Markdown, an HTML embed and mermaid.live.

/** The Mermaid build the HTML embed loads; kept equal to the version the app renders with. */
const MERMAID_CDN: string = 'https://cdn.jsdelivr.net/npm/mermaid@12.1.0/dist/mermaid.esm.min.mjs';
const MERMAID_LIVE: string = 'https://mermaid.live/edit#pako:';
/** `String.fromCharCode` takes its arguments on the stack, so long byte runs go in chunks. */
const CHUNK: number = 0x8000;
const JSON_INDENT: number = 2;

/** A fenced `mermaid` block for GitHub, Notion and docs. */
export function markdownBlock(code: string): string {
  return `\`\`\`mermaid\n${code.trimEnd()}\n\`\`\`\n`;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** A snippet that renders the diagram anywhere with Mermaid from a CDN. */
export function embedHtml(code: string, isDark: boolean): string {
  return [
    '<pre class="mermaid">',
    escapeHtml(code.trimEnd()),
    '</pre>',
    '<script type="module">',
    `  import mermaid from '${MERMAID_CDN}';`,
    `  mermaid.initialize({ startOnLoad: true, theme: '${isDark ? 'dark' : 'default'}' });`,
    '</script>',
    '',
  ].join('\n');
}

/** Base64url without padding, as mermaid.live's `pako:` links use. */
export function base64Url(bytes: Uint8Array): string {
  let binary: string = '';
  for (let start: number = 0; start < bytes.length; start += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(start, start + CHUNK));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** The editor state mermaid.live expects in its link. */
export function mermaidLiveState(code: string, isDark: boolean): string {
  return JSON.stringify({
    code,
    mermaid: JSON.stringify({ theme: isDark ? 'dark' : 'default' }, null, JSON_INDENT),
    autoSync: true,
    updateDiagram: true,
  });
}

async function deflate(text: string): Promise<Uint8Array> {
  const stream: CompressionStream = new CompressionStream('deflate');
  const compressed: Promise<ArrayBuffer> = new Response(stream.readable).arrayBuffer();
  const writer: WritableStreamDefaultWriter<BufferSource> = stream.writable.getWriter();
  await writer.write(new TextEncoder().encode(text));
  await writer.close();
  return new Uint8Array(await compressed);
}

/** A mermaid.live link that opens this diagram: the state, zlib-deflated, in base64url. */
export async function mermaidLiveUrl(code: string, isDark: boolean): Promise<string> {
  return `${MERMAID_LIVE}${base64Url(await deflate(mermaidLiveState(code, isDark)))}`;
}
