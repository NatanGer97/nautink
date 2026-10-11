import { readDiagramFiles } from '@nautink/storage/diagram-files';

import { clip } from '../workspace/text.ts';

import type { NewDiagramDraft } from '../workspace/store/workspace-state.ts';
import type { DiagramDraft, DiagramFileImport, TextFile } from '@nautink/storage/diagram-files';

/** Titles in history labels are cut so the step menu stays one line. */
const LABEL_TITLE_LENGTH: number = 34;

/** Files the picker and the drop overlay accept: Mermaid, Markdown and backups. */
export const IMPORT_ACCEPT: string = '.mmd,.mermaid,.md,.markdown,.json,application/json';

/** Where dropped or picked files go: new diagrams, backups to restore, and files with neither. */
export interface ImportRoute {
  drafts: NewDiagramDraft[];
  backups: TextFile[];
  skipped: string[];
}

function toNewDiagram(draft: DiagramDraft): NewDiagramDraft {
  const name: string = draft.title === '' ? 'file' : draft.title;
  return {
    fields: { code: draft.code, title: draft.title, titleAuto: draft.titleAuto },
    step: { label: `Imported “${clip(name, LABEL_TITLE_LENGTH)}”`, source: 'import' },
  };
}

/**
 * `.mmd` and `.mermaid` files become one diagram each, Markdown one per mermaid block, and `.json`
 * files are restored as backups (v1's rules).
 */
export function routeImport(files: readonly TextFile[]): ImportRoute {
  const found: DiagramFileImport = readDiagramFiles(files);
  return { drafts: found.drafts.map(toNewDiagram), backups: found.backups, skipped: found.skipped };
}

/** The parsed JSON of a backup file. Throws an error that names the file when it is not JSON. */
export function parseBackupText(file: TextFile): unknown {
  try {
    return JSON.parse(file.text) as unknown;
  } catch {
    throw new Error(`${file.name} is not valid JSON.`);
  }
}

function plural(count: number, word: string): string {
  return `${String(count)} ${word}${count === 1 ? '' : 's'}`;
}

/** "Imported 2 diagrams", or with versions: "Restored 3 diagrams and 12 versions". */
export function countsMessage(
  verb: string,
  { diagrams, versions }: { diagrams: number; versions?: number },
): string {
  const tail: string = versions === undefined ? '' : ` and ${plural(versions, 'version')}`;
  return `${verb} ${plural(diagrams, 'diagram')}${tail}`;
}
