const DEFAULT_CLIP: number = 40;
const PLAIN_LABEL: RegExp = /^[\p{L}\p{N}][\p{L}\p{N} _.,?!'-]*$/u;
const KEYWORD_LABEL: RegExp = /^(end|graph|subgraph|flowchart)$/i;

/** Text on one line, shortened to `max` characters with an ellipsis. */
export function clip(text: string, max: number = DEFAULT_CLIP): string {
  const flat: string = text
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

function fromCharCodeEntity(entity: string): string {
  return String.fromCharCode(Number(entity.slice('&#'.length, -1)));
}

/** Mermaid dbs keep entities in a placeholder form (`ﬂ°quot¶ß`); this turns them back into text. */
export function decodeText(text: string): string {
  return text
    .replace(/ﬂ°°/g, '&#')
    .replace(/ﬂ°/g, '&')
    .replace(/¶ß/g, ';')
    .replace(/&quot;|#quot;/g, '"')
    .replace(/&#\d+;/g, fromCharCodeEntity);
}

/** Quotes a label only when it holds characters the flowchart grammar could trip on. */
export function quoteLabel(text: string): string {
  const isPlain: boolean =
    PLAIN_LABEL.test(text) && !text.includes('--') && !KEYWORD_LABEL.test(text);
  if (isPlain) {
    return text;
  }
  return `"${text.replace(/"/g, '#quot;')}"`;
}
