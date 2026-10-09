import type { EditorId } from './editor-contract.ts';

/**
 * A canvas position (top-left). `l` is the label the item had when it was placed, so a reused id
 * with a new meaning is placed again instead of inheriting an old spot. The key stays `l` to match
 * v1's stored data.
 */
export interface Position {
  x: number;
  y: number;
  l?: string;
}

/** Positions of one editor's canvas items, keyed by item id. */
export type PositionMap = Record<string, Position>;

/** Every editor's positions for one diagram. */
export type DiagramPositions = Partial<Record<EditorId, PositionMap>>;

/** Where positions live: one diagram, one editor (`ns` is the editor folder name). */
export interface PositionKey {
  diagramId: string;
  ns: EditorId;
}

/**
 * Storage for canvas positions. Mermaid lays diagrams out itself, so positions exist only here.
 * `@nautink/storage` implements it on IndexedDB; editors only see this interface.
 */
export interface PositionStore {
  load: (key: PositionKey) => Promise<PositionMap>;
  save: (key: PositionKey, positions: PositionMap) => Promise<void>;
  readAll: (diagramId: string) => Promise<DiagramPositions>;
  writeAll: (diagramId: string, all: DiagramPositions) => Promise<void>;
  deleteAll: (diagramId: string) => Promise<void>;
}

function copyPositions(positions: PositionMap): PositionMap {
  return Object.fromEntries(
    Object.entries(positions).map(([id, position]: [string, Position]) => [id, { ...position }]),
  );
}

function copyDiagram(all: DiagramPositions): DiagramPositions {
  return Object.fromEntries(
    Object.entries(all).map(([ns, positions]: [string, PositionMap]) => [
      ns,
      copyPositions(positions),
    ]),
  );
}

/** An in-memory store, for tests and for running an editor without persistence. */
export class MemoryPositionStore implements PositionStore {
  readonly #diagrams: Map<string, DiagramPositions> = new Map<string, DiagramPositions>();

  async load({ diagramId, ns }: PositionKey): Promise<PositionMap> {
    return Promise.resolve(copyPositions(this.#read(diagramId)[ns] ?? {}));
  }

  async save({ diagramId, ns }: PositionKey, positions: PositionMap): Promise<void> {
    this.#write(diagramId, { [ns]: positions });
    return Promise.resolve();
  }

  async readAll(diagramId: string): Promise<DiagramPositions> {
    return Promise.resolve(copyDiagram(this.#read(diagramId)));
  }

  async writeAll(diagramId: string, all: DiagramPositions): Promise<void> {
    this.#write(diagramId, all);
    return Promise.resolve();
  }

  async deleteAll(diagramId: string): Promise<void> {
    this.#diagrams.delete(diagramId);
    return Promise.resolve();
  }

  #read(diagramId: string): DiagramPositions {
    return this.#diagrams.get(diagramId) ?? {};
  }

  #write(diagramId: string, all: DiagramPositions): void {
    this.#diagrams.set(diagramId, { ...this.#read(diagramId), ...copyDiagram(all) });
  }
}
