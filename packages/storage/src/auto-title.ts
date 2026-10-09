import { diagramKeyword, meaningfulLines, typeName } from './diagram-type.ts';

import type { Diagram } from './records.ts';

const MAX_TITLE_LENGTH: number = 48;
const FRONT_MATTER_BODY_RE: RegExp = /^\s*---\n([\s\S]*?)\n---/;
const FRONT_MATTER_TITLE_RE: RegExp = /^title:\s*(.+?)\s*$/m;
const QUOTED_RE: RegExp = /^(['"])(.*)\1$/;
const TITLE_LINE_RE: RegExp = /^title\s+(.+)$/;
const PIE_HEADER_TITLE_RE: RegExp = /^pie\b.*?\btitle\s+(.+)$/;
// Diagram types whose code names the diagram with a `title …` line (PRD §11: a v1 gap).
const TITLED_KEYWORDS: ReadonlySet<string> = new Set(['pie', 'gantt']);
const DATE_FORMAT: Intl.DateTimeFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
});

/** The fields an auto title is made from. */
export type AutoTitleSource = Pick<Diagram, 'code' | 'messages' | 'createdAt'>;

/** One line, collapsed whitespace, cut to `max` characters with an ellipsis. */
export function trimTitle(text: string, max: number = MAX_TITLE_LENGTH): string {
  const oneLine: string = text.replace(/\s+/g, ' ').trim();
  return oneLine.length > max ? `${oneLine.slice(0, max - 1).trimEnd()}…` : oneLine;
}

/** `title:` from leading YAML front matter, or ''. */
export function frontMatterTitle(code: string): string {
  const body: string | undefined = FRONT_MATTER_BODY_RE.exec(code)?.[1];
  const title: string | undefined =
    body === undefined ? undefined : FRONT_MATTER_TITLE_RE.exec(body)?.[1];
  return title === undefined ? '' : title.replace(QUOTED_RE, '$2').trim();
}

/** The title a pie or gantt chart gives itself (`pie title Pets`, a `title …` line), or ''. */
export function codeTitle(code: string): string {
  if (!TITLED_KEYWORDS.has(diagramKeyword(code))) {
    return '';
  }
  const [header = '', ...body] = meaningfulLines(code);
  const inline: string | undefined = PIE_HEADER_TITLE_RE.exec(header)?.[1];
  const fromLine: string | undefined = body
    .map((text) => TITLE_LINE_RE.exec(text)?.[1])
    .find((text) => text !== undefined);
  return (inline ?? fromLine ?? '').trim();
}

function firstTypedMessage(source: AutoTitleSource): string {
  const first: string | undefined = source.messages.find(
    (message) => message.role === 'user' && message.auto !== true && message.text.trim() !== '',
  )?.text;
  return first ?? '';
}

/** Front matter title, else the code's own title, else the first typed chat message, else "Pie · Oct 9". */
export function autoTitle(source: AutoTitleSource): string {
  const candidates: string[] = [
    frontMatterTitle(source.code),
    codeTitle(source.code),
    firstTypedMessage(source),
  ];
  const found: string | undefined = candidates.find((candidate) => candidate !== '');
  if (found !== undefined) {
    return trimTitle(found);
  }
  return `${typeName(source.code)} · ${DATE_FORMAT.format(new Date(source.createdAt))}`;
}
