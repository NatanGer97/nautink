import { computeLayout } from '@nautink/editors/sequence/layout';
import { parse } from '@nautink/editors/sequence/model';
import { approximateTextWidth } from '@nautink/visual-core/text-measure';
import { vi } from 'vitest';

import { NO_SELECTION } from '../src/edit/sequence/sequence-types.ts';
import { loadMermaidDiagram } from '../src/edit/sync/mermaid-loader.ts';

import type { SequenceActionContext } from '../src/edit/sequence/sequence-actions.ts';
import type { EditTarget, SequenceSelection } from '../src/edit/sequence/sequence-types.ts';
import type { SequenceLayout } from '@nautink/editors/sequence/layout';
import type { SequenceModel } from '@nautink/editors/sequence/types';
import type { ParseResult } from '@nautink/visual-core/editor-contract';
import type { Mock } from 'vitest';

/** Alice and Bob, a loop with a message and a note, and a reply. */
export const SAMPLE: string = [
  'sequenceDiagram',
  '    participant A as Alice',
  '    participant B as Bob',
  '    A->>B: Hello',
  '    loop every minute',
  '        B->>A: ping',
  '        Note right of B: busy',
  '    end',
  '    B-->>A: Bye',
  '',
].join('\n');

/** Parses sequence code with Mermaid's own parser; throws when it does not parse. */
export async function sampleModel(code: string = SAMPLE): Promise<SequenceModel> {
  const result: ParseResult<SequenceModel> = await parse(code, loadMermaidDiagram);
  if (result.kind !== 'ok') {
    throw new Error(`Cannot parse the sample: ${result.message}`);
  }
  return result.model;
}

export function layoutOf(model: SequenceModel): SequenceLayout {
  return computeLayout(model, (text: string) => approximateTextWidth(text));
}

export interface TestContext extends SequenceActionContext {
  model: () => SequenceModel;
  commits: Mock<(next: SequenceModel, label: string) => void>;
  selection: () => SequenceSelection;
  editing: () => EditTarget | null;
  setReadOnly: (isReadOnly: boolean) => void;
}

/** An action context over a model that commits in place. */
export function testContext(start: SequenceModel): TestContext {
  let model: SequenceModel = start;
  let selection: SequenceSelection = NO_SELECTION;
  let editing: EditTarget | null = null;
  let isReadOnly: boolean = false;
  const commits = vi.fn((next: SequenceModel) => {
    model = next;
  });
  return {
    model: () => model,
    getModel: () => model,
    commit: commits,
    commits,
    isReadOnly: () => isReadOnly,
    setReadOnly: (isNowReadOnly): void => {
      isReadOnly = isNowReadOnly;
    },
    getSelection: () => selection,
    selection: () => selection,
    select: (next): void => {
      selection = next;
    },
    editing: () => editing,
    edit: (next): void => {
      editing = next;
    },
  };
}
