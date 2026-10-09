import { useEffect, useState, useSyncExternalStore } from 'react';

import { DiagramSync } from './diagram-sync.ts';
import { loadMermaidDiagram } from './mermaid-loader.ts';

import type { CodeWriter, DiagramSyncOptions, SyncSnapshot } from './diagram-sync.ts';
import type { DiagramLoader } from '@nautink/visual-core/editor-contract';

export interface DiagramSyncInput<Model> extends Omit<DiagramSyncOptions<Model>, 'load'> {
  code: string;
  /** Claude is streaming into the code: parse sooner. */
  isBusy: boolean;
  /** False holds parsing back, e.g. until saved positions have loaded. */
  isEnabled: boolean;
  onChange: CodeWriter;
  /** Mermaid's parser through the shared queue unless a test passes another. */
  load?: DiagramLoader;
}

export interface DiagramSyncState<Model> extends SyncSnapshot<Model> {
  /** Serializes `next` and records it as one undo step called `label` (source `visual`). */
  commit: (next: Model, label: string) => void;
  /** Shows `next` without writing code. */
  setModel: (next: Model) => void;
  /** The newest model, for event handlers that run after a render. */
  getModel: () => Model | null;
}

/**
 * Parses the code into the editor model and writes edits back through the history (v1's
 * `useDiagramSync`). The editor follows the store for undo and redo: it keeps no undo stack.
 * `module`, `load` and `onExternal` are read once, when the editor mounts.
 */
export function useDiagramSync<Model>(input: DiagramSyncInput<Model>): DiagramSyncState<Model> {
  const { code, isBusy, isEnabled, onChange } = input;
  const [sync] = useState<DiagramSync<Model>>(
    () => new DiagramSync<Model>({ ...input, load: input.load ?? loadMermaidDiagram }),
  );
  useEffect(() => {
    sync.setWriter(onChange);
  }, [sync, onChange]);
  useEffect(() => {
    if (isEnabled) {
      sync.receive(code, isBusy);
    }
    return (): void => {
      sync.dispose();
    };
  }, [sync, code, isBusy, isEnabled]);
  const snapshot: SyncSnapshot<Model> = useSyncExternalStore(sync.subscribe, sync.getSnapshot);
  return { ...snapshot, commit: sync.commit, setModel: sync.setModel, getModel: sync.getModel };
}
