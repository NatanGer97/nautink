import type { languages } from 'monaco-editor/editor/editor.api.js';

/** Monaco's id for the Mermaid language. */
export const MERMAID_LANGUAGE_ID: string = 'mermaid';

/** First-line keywords: one per diagram type (v1's `monaco.js`). */
export const DIAGRAM_KEYWORDS: readonly string[] = [
  'graph',
  'flowchart',
  'sequenceDiagram',
  'classDiagram',
  'stateDiagram',
  'stateDiagram-v2',
  'erDiagram',
  'journey',
  'gantt',
  'pie',
  'quadrantChart',
  'requirementDiagram',
  'gitGraph',
  'C4Context',
  'C4Container',
  'C4Component',
  'mindmap',
  'timeline',
  'sankey-beta',
  'sankey',
  'xychart-beta',
  'xychart',
  'block-beta',
  'block',
  'packet-beta',
  'packet',
  'kanban',
  'architecture-beta',
  'architecture',
  'radar-beta',
  'treemap-beta',
];

/** Statement keywords shared across diagram types. */
export const STATEMENT_KEYWORDS: readonly string[] = [
  'subgraph',
  'end',
  'direction',
  'participant',
  'actor',
  'as',
  'note',
  'over',
  'left of',
  'right of',
  'loop',
  'alt',
  'else',
  'opt',
  'par',
  'and',
  'critical',
  'break',
  'rect',
  'activate',
  'deactivate',
  'autonumber',
  'class',
  'classDef',
  'style',
  'linkStyle',
  'click',
  'callback',
  'link',
  'section',
  'title',
  'dateFormat',
  'axisFormat',
  'excludes',
  'todayMarker',
  'state',
  'commit',
  'branch',
  'checkout',
  'merge',
  'cherry-pick',
  'accTitle',
  'accDescr',
  'showData',
  'x-axis',
  'y-axis',
  'quadrant-1',
  'quadrant-2',
  'quadrant-3',
  'quadrant-4',
  'TB',
  'TD',
  'BT',
  'RL',
  'LR',
  'group',
  'service',
  'junction',
  'columns',
  'space',
];

/** Arrows and links of every diagram type, longest first so `-->` wins over `--`. */
const OPERATOR_PATTERN: RegExp =
  /(<-->|-->>|-->|---|-\.->|==>|-\.-|===|~~~|->>|--x|--o|<<->>|-x|-\)|\.\.>|\.\.|--|\*--|o--|<\|--|\|\|--o\{|\}o--o\{|\|o--o\||::)/;

/** Comments, strings, link labels, arrows, keywords, colors and numbers. */
export const MERMAID_MONARCH: languages.IMonarchLanguage = {
  diagrams: DIAGRAM_KEYWORDS,
  keywords: STATEMENT_KEYWORDS,
  tokenizer: {
    root: [
      [/%%\{.*\}%%/, 'annotation'],
      [/%%.*$/, 'comment'],
      [/"[^"]*"/, 'string'],
      [/\|[^|]*\|/, 'string'],
      [OPERATOR_PATTERN, 'operator'],
      [
        /[A-Za-z][\w-]*/,
        {
          cases: {
            '@diagrams': 'keyword.diagram',
            '@keywords': 'keyword',
            '@default': 'identifier',
          },
        },
      ],
      [/#[0-9a-fA-F]{3,8}\b/, 'number.hex'],
      [/\d+(\.\d+)?/, 'number'],
      [/[{}[\]()]/, '@brackets'],
    ],
  },
};

/** `%%` comments, bracket matching and auto-closing pairs. */
export const MERMAID_LANGUAGE_CONFIGURATION: languages.LanguageConfiguration = {
  comments: { lineComment: '%%' },
  brackets: [
    ['{', '}'],
    ['[', ']'],
    ['(', ')'],
  ],
  autoClosingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '"', close: '"' },
  ],
};
