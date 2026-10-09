import './monaco-core.ts';
import * as monaco from 'monaco-editor/editor/editor.api.js';

import EditorWorker from './editor.worker.ts?worker';
import { mermaidSuggestions, TRIGGER_CHARACTERS } from './mermaid-completion.ts';
import {
  MERMAID_LANGUAGE_CONFIGURATION,
  MERMAID_LANGUAGE_ID,
  MERMAID_MONARCH,
} from './mermaid-language.ts';
import { MONACO_THEMES } from './monaco-themes.ts';

import type { Suggestion, SuggestionKind } from './mermaid-completion.ts';

/** The Monaco API, as this app loads it. */
export type MonacoApi = typeof monaco;

const KIND: Readonly<Record<SuggestionKind, monaco.languages.CompletionItemKind>> = {
  shape: monaco.languages.CompletionItemKind.EnumMember,
  iconPack: monaco.languages.CompletionItemKind.Module,
  starter: monaco.languages.CompletionItemKind.Keyword,
  snippet: monaco.languages.CompletionItemKind.Snippet,
  operator: monaco.languages.CompletionItemKind.Operator,
};

function toCompletionItem(
  suggestion: Suggestion,
  lineNumber: number,
): monaco.languages.CompletionItem {
  const { label, detail, insertText, sortText, startColumn, endColumn } = suggestion;
  return {
    label,
    kind: KIND[suggestion.kind],
    detail,
    insertText,
    sortText,
    filterText: label,
    range: { startLineNumber: lineNumber, endLineNumber: lineNumber, startColumn, endColumn },
    ...(suggestion.isSnippet
      ? { insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet }
      : {}),
  };
}

const completionProvider: monaco.languages.CompletionItemProvider = {
  triggerCharacters: [...TRIGGER_CHARACTERS],
  provideCompletionItems: (model, position) => {
    const word: monaco.editor.IWordAtPosition = model.getWordUntilPosition(position);
    const suggestions: Suggestion[] = mermaidSuggestions({
      lines: model.getLinesContent(),
      lineNumber: position.lineNumber,
      column: position.column,
      wordStartColumn: word.startColumn,
      wordEndColumn: word.endColumn,
    });
    return { suggestions: suggestions.map((item) => toCompletionItem(item, position.lineNumber)) };
  },
};

function registerMermaid(): void {
  monaco.languages.register({ id: MERMAID_LANGUAGE_ID });
  monaco.languages.setLanguageConfiguration(MERMAID_LANGUAGE_ID, MERMAID_LANGUAGE_CONFIGURATION);
  monaco.languages.setMonarchTokensProvider(MERMAID_LANGUAGE_ID, MERMAID_MONARCH);
  monaco.languages.registerCompletionItemProvider(MERMAID_LANGUAGE_ID, completionProvider);
  for (const [name, data] of Object.entries(MONACO_THEMES)) {
    monaco.editor.defineTheme(name, data);
  }
}

// Bundled with the app, not loaded from a CDN; the worker is a module Vite builds.
self.MonacoEnvironment = { getWorker: (): Worker => new EditorWorker() };
registerMermaid();

export { monaco };
