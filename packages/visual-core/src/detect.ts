import { splitPreamble } from './preamble.ts';

import type { EditorId } from './editor-contract.ts';

/** Display name and blank template of each editor. */
export interface EditorInfo {
  name: string;
  template: string;
}

export const EDITORS: Readonly<Record<EditorId, EditorInfo>> = {
  flow: { name: 'Flowchart', template: 'flowchart TD\n' },
  class: { name: 'Class (UML)', template: 'classDiagram\n    class Class1\n' },
  sequence: { name: 'Sequence', template: 'sequenceDiagram\n' },
  er: { name: 'Entity relationship', template: 'erDiagram\n' },
  state: { name: 'State', template: 'stateDiagram-v2\n' },
};

const KEYWORDS: readonly (readonly [RegExp, EditorId])[] = [
  [/^(flowchart|graph)\b/, 'flow'],
  [/^classDiagram(-v2)?\b/, 'class'],
  [/^sequenceDiagram\b/, 'sequence'],
  [/^erDiagram\b/, 'er'],
  [/^stateDiagram(-v2)?\b/, 'state'],
];

/** The editor for a diagram (null when its type has none), its first keyword, and whether it is empty. */
export interface DetectedType {
  editor: EditorId | null;
  keyword: string;
  isEmpty: boolean;
}

/** Picks the editor from the diagram's first keyword, skipping the preamble and comments. */
export function detectType(code: string): DetectedType {
  const line: string | undefined = splitPreamble(code)
    .body.split('\n')
    .map((text: string) => text.trim())
    .find((text: string) => text !== '' && !text.startsWith('%%'));
  if (line === undefined) {
    return { editor: null, keyword: '', isEmpty: true };
  }
  const hit: readonly [RegExp, EditorId] | undefined = KEYWORDS.find(([pattern]) =>
    pattern.test(line),
  );
  return { editor: hit ? hit[1] : null, keyword: line.split(/\s/)[0] ?? '', isEmpty: false };
}
