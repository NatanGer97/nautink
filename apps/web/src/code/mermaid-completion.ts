import { SHAPES } from '@nautink/editors/flow/library';
import { detectType } from '@nautink/visual-core/detect';
import { ICON_PACKS } from '@nautink/visual-core/icons';

import { SNIPPETS_BY_TYPE, STARTERS } from './completion-snippets.ts';

import type { EditorId } from '@nautink/visual-core/editor-contract';

export type SuggestionKind = 'shape' | 'iconPack' | 'starter' | 'snippet' | 'operator';

/** One completion item, independent of Monaco; `startColumn`/`endColumn` are on the cursor's line. */
export interface Suggestion {
  label: string;
  kind: SuggestionKind;
  detail: string;
  insertText: string;
  isSnippet: boolean;
  startColumn: number;
  endColumn: number;
  sortText: string;
}

/** Where completion was asked for: the model's lines and the cursor (1-based, Monaco style). */
export interface CompletionContext {
  lines: readonly string[];
  lineNumber: number;
  column: number;
  /** The word under the cursor, as Monaco's `getWordUntilPosition` reports it. */
  wordStartColumn: number;
  wordEndColumn: number;
}

const SORT_WIDTH: number = 3;
const SHAPE_CONTEXT: RegExp = /@\{[^}]*\bshape:\s*[\w-]*$/;
const ICON_CONTEXT: RegExp = /\bicon:\s*"[\w-]*$/;
const TYPED_NAME: RegExp = /[\w-]*$/;
const TYPED_OPERATOR: RegExp = /[-=.<>|*{}()[\]]*$/;
const OPERATOR_LABEL: RegExp = /^[-=.<>|}*[]|^o--/;

function sortKey(index: number): string {
  return String(index).padStart(SORT_WIDTH, '0');
}

function lineBefore(context: CompletionContext): string {
  return (context.lines[context.lineNumber - 1] ?? '').slice(0, context.column - 1);
}

/** Inside `@{ shape: ` → the flowchart shape names. */
function shapeSuggestions(context: CompletionContext, before: string): Suggestion[] {
  const typed: string = TYPED_NAME.exec(before)?.[0] ?? '';
  return SHAPES.map((shape, index) => ({
    label: shape.id,
    kind: 'shape',
    detail: shape.name,
    insertText: shape.id,
    isSnippet: false,
    startColumn: context.column - typed.length,
    endColumn: context.wordEndColumn,
    sortText: sortKey(index),
  }));
}

/** Inside `icon: "` → the icon pack prefixes. */
function iconPackSuggestions(context: CompletionContext, before: string): Suggestion[] {
  const typed: string = TYPED_NAME.exec(before)?.[0] ?? '';
  return ICON_PACKS.map((pack, index) => ({
    label: `${pack.prefix}:`,
    kind: 'iconPack',
    detail: pack.name,
    insertText: `${pack.prefix}:`,
    isSnippet: false,
    startColumn: context.column - typed.length,
    endColumn: context.wordEndColumn,
    sortText: sortKey(index),
  }));
}

function starterSuggestions(context: CompletionContext): Suggestion[] {
  return STARTERS.map(([label, detail], index) => ({
    label,
    kind: 'starter',
    detail,
    insertText: `${label}\n`,
    isSnippet: false,
    startColumn: context.wordStartColumn,
    endColumn: context.wordEndColumn,
    sortText: sortKey(index),
  }));
}

/** Snippets of the diagram's type. Arrow items replace any arrow characters already typed. */
function snippetSuggestions(
  context: CompletionContext,
  type: EditorId,
  before: string,
): Suggestion[] {
  const typedOperator: string = TYPED_OPERATOR.exec(before)?.[0] ?? '';
  return SNIPPETS_BY_TYPE[type].map((snippet, index) => {
    const isOperator: boolean = OPERATOR_LABEL.test(snippet.label);
    return {
      ...snippet,
      kind: isOperator ? 'operator' : 'snippet',
      isSnippet: true,
      startColumn: isOperator ? context.column - typedOperator.length : context.wordStartColumn,
      endColumn: context.wordEndColumn,
      sortText: sortKey(index),
    };
  });
}

/** The index of the first line with content (not blank, a comment or a front matter fence). */
function firstContentLine(lines: readonly string[]): number {
  return lines.findIndex((line: string) => {
    const text: string = line.trim();
    return text !== '' && !text.startsWith('%%') && text !== '---';
  });
}

/** v1's completion: shapes, icon packs, diagram starters, then the snippets of the diagram's type. */
export function mermaidSuggestions(context: CompletionContext): Suggestion[] {
  const before: string = lineBefore(context);
  if (SHAPE_CONTEXT.test(before)) {
    return shapeSuggestions(context, before);
  }
  if (ICON_CONTEXT.test(before)) {
    return iconPackSuggestions(context, before);
  }
  const type: EditorId | null = detectType(context.lines.join('\n')).editor;
  const isOnFirstLine: boolean = context.lineNumber - 1 <= firstContentLine(context.lines);
  if (type === null || isOnFirstLine) {
    return starterSuggestions(context);
  }
  return snippetSuggestions(context, type, before);
}

/** The characters that open the suggestion list by themselves. */
export const TRIGGER_CHARACTERS: readonly string[] = [' ', ':', '"', '-', '<', '|', '['];
