/**
 * The small Markdown subset Claude's replies use, parsed into a tree the chat renders as React
 * elements: never as HTML, so a reply cannot inject markup. Anything else stays plain text.
 */
export type Inline =
  | { kind: 'text'; text: string }
  | { kind: 'strong'; children: Inline[] }
  | { kind: 'em'; children: Inline[] }
  | { kind: 'code'; text: string }
  | { kind: 'link'; href: string; children: Inline[] };

export type Block =
  | { kind: 'paragraph'; inlines: Inline[] }
  | { kind: 'heading'; inlines: Inline[] }
  | { kind: 'list'; isOrdered: boolean; items: Inline[][] }
  | { kind: 'code'; text: string };

// One alternative per inline form; the first match in the text wins.
const INLINE_PATTERN: RegExp =
  /`([^`\n]+)`|\*\*(.+?)\*\*|__(.+?)__|\*([^*\s][^*\n]*?)\*|_([^_\s][^_\n]*?)_|\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/u;

const BULLET: RegExp = /^\s*[-*+]\s+(.*)$/u;
const NUMBERED: RegExp = /^\s*\d+[.)]\s+(.*)$/u;
const HEADING: RegExp = /^#{1,6}\s+(.*)$/u;
const FENCE: RegExp = /^\s*```/u;
/** A fenced block's opening and closing fence lines. */
const FENCE_LINES: number = 2;

function inlineFromMatch(match: RegExpExecArray): Inline {
  const [, code, strong, strongAlt, em, emAlt, linkText, href] = match;
  if (code !== undefined) {
    return { kind: 'code', text: code };
  }
  const bold: string | undefined = strong ?? strongAlt;
  if (bold !== undefined) {
    return { kind: 'strong', children: parseInline(bold) };
  }
  const italic: string | undefined = em ?? emAlt;
  if (italic !== undefined) {
    return { kind: 'em', children: parseInline(italic) };
  }
  return { kind: 'link', href: href ?? '', children: parseInline(linkText ?? '') };
}

/** Bold, italic, inline code and http(s) links inside one line or paragraph. */
export function parseInline(text: string): Inline[] {
  const inlines: Inline[] = [];
  let rest: string = text;
  let match: RegExpExecArray | null = INLINE_PATTERN.exec(rest);
  while (match !== null) {
    if (match.index > 0) {
      inlines.push({ kind: 'text', text: rest.slice(0, match.index) });
    }
    inlines.push(inlineFromMatch(match));
    rest = rest.slice(match.index + match[0].length);
    match = INLINE_PATTERN.exec(rest);
  }
  if (rest !== '') {
    inlines.push({ kind: 'text', text: rest });
  }
  return inlines;
}

/** A block read from `lines`, and the index of the first line after it. */
interface Read {
  block: Block;
  next: number;
}

/** Lines from `start` while `isPart` holds for each. */
function takeWhile(
  lines: readonly string[],
  start: number,
  isPart: (line: string) => boolean,
): string[] {
  const taken: string[] = [];
  for (const line of lines.slice(start)) {
    if (!isPart(line)) {
      break;
    }
    taken.push(line);
  }
  return taken;
}

function readCode(lines: readonly string[], start: number): Read {
  const body: string[] = takeWhile(lines, start + 1, (line: string) => !FENCE.test(line));
  return {
    block: { kind: 'code', text: body.join('\n') },
    next: start + body.length + FENCE_LINES,
  };
}

function readList(lines: readonly string[], start: number, pattern: RegExp): Read {
  const items: string[] = takeWhile(lines, start, (line: string) => pattern.test(line));
  return {
    block: {
      kind: 'list',
      isOrdered: pattern === NUMBERED,
      items: items.map((line: string) => parseInline(pattern.exec(line)?.[1] ?? '')),
    },
    next: start + items.length,
  };
}

function isBlockStart(line: string): boolean {
  return [BULLET, NUMBERED, HEADING, FENCE].some((pattern: RegExp) => pattern.test(line));
}

function readParagraph(lines: readonly string[], start: number): Read {
  const body: string[] = takeWhile(
    lines,
    start,
    (line: string) => line.trim() !== '' && !isBlockStart(line),
  );
  return {
    block: { kind: 'paragraph', inlines: parseInline(body.join('\n')) },
    next: start + body.length,
  };
}

function readBlock(lines: readonly string[], start: number): Read {
  const line: string = lines[start] ?? '';
  if (FENCE.test(line)) {
    return readCode(lines, start);
  }
  if (HEADING.test(line)) {
    const inlines: Inline[] = parseInline(HEADING.exec(line)?.[1] ?? '');
    return { block: { kind: 'heading', inlines }, next: start + 1 };
  }
  if (BULLET.test(line)) {
    return readList(lines, start, BULLET);
  }
  return NUMBERED.test(line) ? readList(lines, start, NUMBERED) : readParagraph(lines, start);
}

/** Paragraphs, headings, bullet and numbered lists, and fenced code blocks. */
export function parseMarkdown(text: string): Block[] {
  const lines: readonly string[] = text.split('\n');
  const blocks: Block[] = [];
  let index: number = 0;
  while (index < lines.length) {
    if ((lines[index] ?? '').trim() === '') {
      index += 1;
      continue;
    }
    const read: Read = readBlock(lines, index);
    blocks.push(read.block);
    index = read.next;
  }
  return blocks;
}
