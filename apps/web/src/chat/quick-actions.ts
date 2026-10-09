import { diagramKeyword, meaningfulLines } from '@nautink/storage/diagram-type';

/** A chip that sends a ready-made prompt about the current diagram. */
export interface QuickAction {
  label: string;
  prompt: string;
}

/** v1's `COMMON_ACTIONS`, for every diagram type. */
export const COMMON_ACTIONS: readonly QuickAction[] = [
  {
    label: 'Explain',
    prompt: 'Explain what this diagram shows in a few short sentences. Do not change the diagram.',
  },
  {
    label: 'Review',
    prompt:
      'Review this diagram for syntax problems, logic gaps and readability. List the issues briefly. If changes are needed, return the full corrected diagram.',
  },
  {
    label: 'Simplify',
    prompt: 'Simplify this diagram: merge or remove redundant steps and keep the main flow clear.',
  },
  {
    label: 'More readable',
    prompt:
      'Make this diagram easier to read: clearer labels, consistent naming, better grouping and direction. Keep the meaning.',
  },
  {
    label: 'More detail',
    prompt: 'Add more useful detail to this diagram where it is thin, without changing its scope.',
  },
];

/** The five types with a visual editor, as v1's `TYPE_ACTIONS` keys them. */
export type EditorKind = 'flow' | 'class' | 'sequence' | 'er' | 'state';

/** v1's `TYPE_ACTIONS`: two extra chips per visual type, shown first. */
export const TYPE_ACTIONS: Readonly<Record<EditorKind, readonly QuickAction[]>> = {
  flow: [
    {
      label: 'Add error handling',
      prompt:
        'Add error and failure paths to this flowchart, including retries or fallbacks where they make sense.',
    },
    {
      label: 'To sequence',
      prompt: 'Convert this flowchart into a sequenceDiagram showing the same interactions.',
    },
  ],
  class: [
    {
      label: 'Add methods',
      prompt:
        'Add the most important missing attributes and methods to these classes, with types and visibility.',
    },
    {
      label: 'Add interfaces',
      prompt:
        'Introduce interfaces or abstract classes where they improve this design, with realization relations.',
    },
  ],
  sequence: [
    {
      label: 'Add error paths',
      prompt: 'Add error responses and failure handling to this sequence diagram using alt blocks.',
    },
    {
      label: 'Add activations',
      prompt: 'Add activation bars (+/-) and autonumber to make the call flow clearer.',
    },
  ],
  er: [
    {
      label: 'Add timestamps',
      prompt:
        'Add created_at and updated_at columns to every entity, and any missing foreign keys.',
    },
    {
      label: 'Normalize',
      prompt:
        'Normalize this data model: split repeated data into entities and add the right relationships and keys.',
    },
  ],
  state: [
    {
      label: 'Add error states',
      prompt: 'Add error, timeout and cancellation states with the transitions that lead to them.',
    },
    {
      label: 'To flowchart',
      prompt: 'Convert this state machine into a flowchart that shows the same behaviour.',
    },
  ],
};

const EDITOR_BY_KEYWORD: Readonly<Record<string, EditorKind>> = {
  flowchart: 'flow',
  graph: 'flow',
  classDiagram: 'class',
  sequenceDiagram: 'sequence',
  erDiagram: 'er',
  stateDiagram: 'state',
  'stateDiagram-v2': 'state',
};

/** v1's examples for an empty chat. */
export const EXAMPLE_PROMPTS: readonly string[] = [
  'Sequence diagram of an OAuth login with PKCE',
  'ER diagram for a blog: users, posts, comments, tags',
  'Flowchart for a CI pipeline with lint, test, build, deploy and a rollback branch',
  'State diagram of an order: placed, paid, shipped, delivered, cancelled',
];

/** The visual editor type of the code, or `null` for code-only and empty diagrams. */
export function editorKind(code: string): EditorKind | null {
  return EDITOR_BY_KEYWORD[diagramKeyword(code)] ?? null;
}

/** True when there is a diagram to act on: a type line and at least one more line (as v1). */
export function hasDiagramContent(code: string): boolean {
  return meaningfulLines(code).length > 1;
}

/** The chips for this code: its type's actions first, then the common ones; none for no diagram. */
export function quickActionsFor(code: string): readonly QuickAction[] {
  if (!hasDiagramContent(code)) {
    return [];
  }
  const kind: EditorKind | null = editorKind(code);
  return kind === null ? COMMON_ACTIONS : [...TYPE_ACTIONS[kind], ...COMMON_ACTIONS];
}
