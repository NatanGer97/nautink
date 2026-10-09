// A small stand-in for the Monaco API, enough for the code drawer's bindings in jsdom (Monaco itself
// needs a real layout engine). It implements only what `src/code/` calls.

type Listener<T> = (event: T) => void;

interface FakeUri {
  scheme: string;
  authority: string;
  path: string;
  toString: () => string;
}

interface Position {
  lineNumber: number;
  column: number;
}

interface Range {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
}

export interface FakeSelection {
  selectionStartLineNumber: number;
  selectionStartColumn: number;
  positionLineNumber: number;
  positionColumn: number;
}

export class FakeModel {
  readonly uri: FakeUri;
  private value: string;
  private isDisposedFlag = false;
  readonly listeners = new Set<Listener<unknown>>();

  constructor(value: string, uri: FakeUri) {
    this.value = value;
    this.uri = uri;
  }

  getValue(): string {
    return this.value;
  }

  getLinesContent(): string[] {
    return this.value.split('\n');
  }

  getLineCount(): number {
    return this.getLinesContent().length;
  }

  getLineMaxColumn(line: number): number {
    return (this.getLinesContent()[line - 1] ?? '').length + 1;
  }

  getPositionAt(offset: number): Position {
    const before = this.value.slice(0, offset).split('\n');
    return { lineNumber: before.length, column: (before.at(-1) ?? '').length + 1 };
  }

  getOffsetAt(position: Position): number {
    const lines = this.getLinesContent().slice(0, position.lineNumber - 1);
    return lines.reduce((sum, line) => sum + line.length + 1, 0) + position.column - 1;
  }

  applyEdits(edits: { range: Range; text: string }[]): void {
    for (const { range, text } of edits) {
      const start = this.getOffsetAt({
        lineNumber: range.startLineNumber,
        column: range.startColumn,
      });
      const end = this.getOffsetAt({ lineNumber: range.endLineNumber, column: range.endColumn });
      this.value = this.value.slice(0, start) + text + this.value.slice(end);
    }
    for (const listener of this.listeners) {
      listener({});
    }
  }

  dispose(): void {
    this.isDisposedFlag = true;
    fakeMonacoState.models.delete(this.uri.toString());
  }

  isDisposed(): boolean {
    return this.isDisposedFlag;
  }
}

function disposable(set: Set<Listener<never>>, listener: Listener<never>): { dispose: () => void } {
  set.add(listener);
  return { dispose: () => set.delete(listener) };
}

export class FakeEditor {
  model: FakeModel | null = null;
  isFocused = false;
  selection: FakeSelection = {
    selectionStartLineNumber: 1,
    selectionStartColumn: 1,
    positionLineNumber: 1,
    positionColumn: 1,
  };
  isDisposed = false;
  readonly container: HTMLElement;
  readonly contentListeners = new Set<Listener<never>>();
  readonly selectionListeners = new Set<Listener<never>>();
  readonly blurListeners = new Set<Listener<never>>();
  readonly positionListeners = new Set<Listener<never>>();
  private detachModel: () => void = () => undefined;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  getModel(): FakeModel | null {
    return this.model;
  }

  setModel(model: FakeModel | null): void {
    this.detachModel();
    this.model = model;
    if (model !== null) {
      const relay = (): void => {
        for (const listener of this.contentListeners) {
          (listener as Listener<unknown>)({});
        }
      };
      model.listeners.add(relay);
      this.detachModel = (): void => {
        model.listeners.delete(relay);
      };
    }
  }

  onDidChangeModelContent(listener: Listener<never>): { dispose: () => void } {
    return disposable(this.contentListeners, listener);
  }

  onDidChangeCursorSelection(listener: Listener<never>): { dispose: () => void } {
    return disposable(this.selectionListeners, listener);
  }

  onDidBlurEditorText(listener: Listener<never>): { dispose: () => void } {
    return disposable(this.blurListeners, listener);
  }

  onDidChangeCursorPosition(listener: Listener<never>): { dispose: () => void } {
    return disposable(this.positionListeners, listener);
  }

  getContainerDomNode(): HTMLElement {
    return this.container;
  }

  getSelection(): FakeSelection {
    return this.selection;
  }

  setSelection(selection: FakeSelection): void {
    this.selection = selection;
    const position = { lineNumber: selection.positionLineNumber, column: selection.positionColumn };
    for (const listener of this.positionListeners) {
      (listener as Listener<unknown>)({ position });
    }
  }

  setPosition(position: Position): void {
    this.selection = {
      selectionStartLineNumber: position.lineNumber,
      selectionStartColumn: position.column,
      positionLineNumber: position.lineNumber,
      positionColumn: position.column,
    };
  }

  getPosition(): Position {
    return { lineNumber: this.selection.positionLineNumber, column: this.selection.positionColumn };
  }

  hasTextFocus(): boolean {
    return this.isFocused;
  }

  revealLineInCenterIfOutsideViewport(): void {
    return undefined;
  }

  revealLineInCenter(): void {
    return undefined;
  }

  focus(): void {
    this.isFocused = true;
  }

  dispose(): void {
    this.isDisposed = true;
  }

  /** Fires a cursor event as Monaco would for a click or an arrow key. */
  moveCursor(position: Position, source: string): void {
    this.setPosition(position);
    for (const listener of this.selectionListeners) {
      (listener as Listener<unknown>)({ source, reason: 3 });
    }
    for (const listener of this.positionListeners) {
      (listener as Listener<unknown>)({ position });
    }
  }

  /** Types at the end of the model, as the user would. */
  typeAtEnd(text: string): void {
    const model = this.model;
    if (model === null) {
      throw new Error('The fake editor has no model.');
    }
    const end = model.getPositionAt(model.getValue().length);
    model.applyEdits([
      {
        range: {
          startLineNumber: end.lineNumber,
          startColumn: end.column,
          endLineNumber: end.lineNumber,
          endColumn: end.column,
        },
        text,
      },
    ]);
  }
}

export const fakeMonacoState = {
  models: new Map<string, FakeModel>(),
  editors: [] as FakeEditor[],
  markers: new Map<string, unknown[]>(),
  theme: '',
};

/** Forgets every model, editor, marker and theme between tests. */
export function resetFakeMonaco(): void {
  fakeMonacoState.models.clear();
  fakeMonacoState.editors.length = 0;
  fakeMonacoState.markers.clear();
  fakeMonacoState.theme = '';
}

function expectMermaid(language: string): void {
  if (language !== 'mermaid') {
    throw new Error(`Unexpected model language "${language}".`);
  }
}

function uriFrom(parts: { scheme: string; authority: string; path: string }): FakeUri {
  return { ...parts, toString: () => `${parts.scheme}://${parts.authority}${parts.path}` };
}

export const fakeMonaco = {
  Uri: { from: uriFrom },
  MarkerSeverity: { Error: 8 },
  editor: {
    CursorChangeReason: { Explicit: 3 },
    create: (container: HTMLElement): FakeEditor => {
      const created = new FakeEditor(container);
      fakeMonacoState.editors.push(created);
      return created;
    },
    getModel: (uri: FakeUri): FakeModel | null =>
      fakeMonacoState.models.get(uri.toString()) ?? null,
    getModels: (): FakeModel[] => [...fakeMonacoState.models.values()],
    createModel: (value: string, language: string, uri: FakeUri): FakeModel => {
      expectMermaid(language);
      const model = new FakeModel(value, uri);
      fakeMonacoState.models.set(uri.toString(), model);
      return model;
    },
    setModelMarkers: (model: FakeModel, owner: string, markers: unknown[]): void => {
      fakeMonacoState.markers.set(`${owner}:${model.uri.toString()}`, markers);
    },
    setTheme: (name: string): void => {
      fakeMonacoState.theme = name;
    },
  },
};
