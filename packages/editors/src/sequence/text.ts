// Text helpers for sequence diagrams: Mermaid's `#name;` entities and its line breaks.
import { decodeText } from '@nautink/visual-core/text';

const NAMED: ReadonlyMap<string, string> = new Map(
  Object.entries({
    quot: '"',
    amp: '&',
    lt: '<',
    gt: '>',
    nbsp: ' ',
    apos: "'",
    hellip: '…',
    copy: '©',
    reg: '®',
  }),
);

/** Db text to model text. Named entities Mermaid leaves as `&name;` go back to `#name;`. */
export function decode(text: string | undefined): string {
  return decodeText(text ?? '').replace(/&(\w+);/g, '#$1;');
}

function escapeEntity(entity: string): string {
  if (entity.length > 1) {
    return entity;
  }
  return entity === '#' ? '#35;' : '#59;';
}

/** Text after `:`, `as` or a block keyword, which cannot hold `#`, `;` or newlines. */
export function esc(text: string): string {
  return text.replace(/\r?\n/g, '<br>').replace(/#\w+;|#|;/g, escapeEntity);
}

function entityName(entity: string): string {
  return entity.slice(1, -1);
}

/** For display: `#9829;` → ♥, `#quot;` → ", `<br>` → newline. */
export function displayText(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/#\d+;/g, (entity: string) => String.fromCodePoint(Number(entityName(entity))))
    .replace(/#\w+;/g, (entity: string) => NAMED.get(entityName(entity)) ?? entity);
}
