import { frontMatterTitle, trimTitle } from './auto-title.ts';

import type { Diagram } from '../db/records.ts';

const MAX_SLUG_LENGTH: number = 80;
const MERMAID_FENCE_RE: RegExp = /^(`{3,}|~{3,})[ \t]*mermaid[^\n]*\n([\s\S]*?)^\1[ \t]*$/gm;

/** A dropped or picked file, already read as text. */
export interface TextFile {
  name: string;
  text: string;
}

/** What a new diagram is made from. */
export type DiagramDraft = Pick<Diagram, 'code' | 'title' | 'titleAuto'>;

/** Diagrams found in the files, the names of files with none, and the `.json` files (backups). */
export interface DiagramFileImport {
  drafts: DiagramDraft[];
  skipped: string[];
  backups: TextFile[];
}

function extensionOf(name: string): string {
  return /\.([a-z]+)$/.exec(name.toLowerCase())?.[1] ?? '';
}

function baseNameOf(name: string): string {
  return name.replace(/\.[^.]+$/, '');
}

function readMermaidFile(file: TextFile): DiagramDraft[] {
  const code: string = file.text.replace(/\r\n/g, '\n');
  if (code.trim() === '') {
    return [];
  }
  const title: string = frontMatterTitle(code);
  if (title === '') {
    return [{ code, title: trimTitle(baseNameOf(file.name)), titleAuto: false }];
  }
  return [{ code, title: trimTitle(title), titleAuto: true }];
}

function readMarkdownFile(file: TextFile): DiagramDraft[] {
  const text: string = file.text.replace(/\r\n/g, '\n');
  const blocks: string[] = [...text.matchAll(MERMAID_FENCE_RE)]
    .map((match) => match[2] ?? '')
    .filter((code) => code.trim() !== '');
  const base: string = baseNameOf(file.name);
  return blocks.map((code, index) => ({
    code,
    title: trimTitle(blocks.length > 1 ? `${base} ${String(index + 1)}` : base),
    titleAuto: false,
  }));
}

function readFile(file: TextFile): DiagramDraft[] {
  const extension: string = extensionOf(file.name);
  if (extension === 'mmd' || extension === 'mermaid') {
    return readMermaidFile(file);
  }
  if (extension === 'md' || extension === 'markdown') {
    return readMarkdownFile(file);
  }
  return [];
}

/**
 * Text files → diagram drafts. `.mmd`/`.mermaid`: one diagram each. `.md`/`.markdown`: one per
 * ```mermaid block. `.json` files are handed back as possible backups; anything else is skipped.
 */
export function readDiagramFiles(files: readonly TextFile[]): DiagramFileImport {
  const result: DiagramFileImport = { drafts: [], skipped: [], backups: [] };
  for (const file of files) {
    if (extensionOf(file.name) === 'json') {
      result.backups.push(file);
      continue;
    }
    const drafts: DiagramDraft[] = readFile(file);
    if (drafts.length === 0) {
      result.skipped.push(file.name);
    }
    result.drafts.push(...drafts);
  }
  return result;
}

/** A safe file name (without extension) for downloading a diagram. */
export function fileSlug(title: string): string {
  const slug: string = title
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH);
  return slug === '' ? 'diagram' : slug;
}
