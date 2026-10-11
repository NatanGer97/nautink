/** The five diagram types that have a visual editor, keyed by editor folder name. */
export type EditorId = 'flow' | 'class' | 'sequence' | 'er' | 'state';

/** What Mermaid's `getDiagramFromText` returns that an editor reads: the diagram type and its db. */
export interface MermaidDiagram {
  type: string;
  db: unknown;
}

/** Parses Mermaid source with Mermaid's own parser. Injected, so editors never import Mermaid. */
export type DiagramLoader = (code: string) => Promise<MermaidDiagram>;

/** Why a parse produced no model: invalid code, or code for another diagram type. */
export type ParseFailureKind = 'error' | 'unsupported';

export interface ParseSuccess<Model> {
  kind: 'ok';
  model: Model;
}

export interface ParseFailure {
  kind: ParseFailureKind;
  message: string;
}

export type ParseResult<Model> = ParseSuccess<Model> | ParseFailure;

/** The pure half of an editor: Mermaid code to model and back. */
export interface EditorModule<Model> {
  id: EditorId;
  emptyModel: () => Model;
  parse: (code: string, load: DiagramLoader) => Promise<ParseResult<Model>>;
  serialize: (model: Model) => string;
}

/** Props every editor component takes. `onChange` replaces the code as one labelled undo step. */
export interface EditorProps {
  code: string;
  onChange: (code: string, label?: string) => void;
  isDark: boolean;
  isBusy: boolean;
}
