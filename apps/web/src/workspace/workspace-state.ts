import type { SaveState } from './autosave.ts';
import type { EditEntry, EditMeta, EditStack } from './edit-history.ts';
import type { WorkspaceDeps } from './workspace-deps.ts';
import type { WorkspaceRuntime } from './workspace-runtime.ts';
import type { ImportResult } from '@nautink/storage/backup';
import type { Backup } from '@nautink/storage/backup-format';
import type { NautinkDb } from '@nautink/storage/db';
import type { DeletedDiagram } from '@nautink/storage/diagram-delete';
import type { ChatMessage, Diagram, DiagramView } from '@nautink/storage/records';
import type { StoreApi, UseBoundStore } from 'zustand';

/** Where opening the database stands. */
export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

/** The workspace: every diagram, the open one, save state and each diagram's edit history. */
export interface WorkspaceData {
  status: LoadStatus;
  loadError: string | null;
  /** In no particular order; `sortDiagrams` gives the list order. */
  diagrams: readonly Diagram[];
  activeId: string | null;
  saveState: SaveState;
  /** Undo/redo stacks by diagram id, kept for the session only. */
  histories: Readonly<Record<string, EditStack>>;
  /** The diagram whose title is being edited in the diagrams panel. */
  renamingId: string | null;
  /** True until the diagrams panel has focused its search box for ⌘K "Search diagrams". */
  isSearchFocusRequested: boolean;
}

/** A code change through the history; `diagramId` defaults to the open diagram. */
export type EditRequest = EditMeta & { diagramId?: string };

/** Diagram library actions: the diagrams panel and ⌘K use these. */
export interface LibraryActions {
  /** Opens the database and the remembered diagram, creating a first diagram when there is none. */
  load: () => Promise<void>;
  createDiagram: () => Promise<void>;
  selectDiagram: (id: string) => void;
  /** Throws for a blank title. */
  renameDiagram: (id: string, title: string) => void;
  togglePin: (id: string) => void;
  duplicateDiagram: (id: string) => Promise<void>;
  /** Deletes with an Undo notice. */
  deleteDiagram: (id: string) => Promise<void>;
  restoreDiagram: (deleted: DeletedDiagram, shouldOpen: boolean) => Promise<void>;
  downloadDiagram: (id: string) => void;
}

/** What a new diagram is made from: its code, and optionally its title and view. */
export type NewDiagramFields = Pick<Diagram, 'code'> &
  Partial<Pick<Diagram, 'title' | 'titleAuto' | 'view'>>;

/** A diagram to create, and the first step of its history ("New pie chart from example"). */
export interface NewDiagramDraft {
  fields: NewDiagramFields;
  step: EditMeta;
}

/** New diagrams from code, and backups. */
export interface ImportActions {
  /**
   * Saves a diagram per draft and opens the last one. Returns the saved records; on a failure it
   * shows an error notice and returns none.
   */
  createDiagrams: (drafts: readonly NewDiagramDraft[]) => Promise<Diagram[]>;
  /**
   * Merges a parsed backup file (Nautink or v1) into the workspace; opens its most recent diagram
   * when the workspace was untouched. Throws `InvalidBackupError` for a file that is not a backup.
   */
  importBackup: (data: unknown) => Promise<ImportResult>;
  /** Every diagram, version and position, after writing what is queued. */
  exportBackup: () => Promise<Backup>;
}

/** Code changes and undo/redo. Every feature changes code through `applyEdit`. */
export interface EditActions {
  /** Records `code` as a labelled step and saves it. Returns the step that now holds the code. */
  applyEdit: (code: string, request: EditRequest) => EditEntry;
  /**
   * Replaces the code of the newest step if it still is one (a Claude auto-fix retry).
   * `diagramId` defaults to the open diagram.
   */
  amendEdit: (entryId: number, code: string, diagramId?: string) => boolean;
  /** Ends the typing group: call on a cursor jump, a paste or when the editor loses focus. */
  closeEditGroup: () => void;
  undo: () => void;
  redo: () => void;
  /** Moves the open diagram to state `index` of its stack. */
  jumpTo: (index: number) => void;
}

/** The other saved fields of a diagram. */
export interface FieldActions {
  updateMessages: (id: string, update: (messages: readonly ChatMessage[]) => ChatMessage[]) => void;
  setSessionId: (id: string, sessionId: string | null) => void;
  setDraft: (id: string, draft: string) => void;
  setView: (id: string, view: DiagramView) => void;
  /** Writes every queued change now. */
  flushSaves: () => Promise<void>;
  /** The open database, for features that write their own stores (versions). Throws before `load`. */
  getDb: () => NautinkDb;
  /**
   * The open database, for features that keep their own records there (versions). Call
   * `flushSaves` first when reading diagrams from it. Throws before `load` has finished.
   */
  requireDb: () => NautinkDb;
}

/** Requests from ⌘K to the diagrams panel, and teardown. */
export interface RequestActions {
  startRename: (id: string) => void;
  endRename: () => void;
  requestSearchFocus: () => void;
  /** The panel calls this once it has focused the search box. */
  takeSearchFocusRequest: () => void;
  /** Closes the database and forgets everything, unsaved changes included. For tests. */
  reset: () => void;
}

export type WorkspaceState = WorkspaceData &
  LibraryActions &
  ImportActions &
  EditActions &
  FieldActions &
  RequestActions;

export type WorkspaceStore = UseBoundStore<StoreApi<WorkspaceState>>;

/** What every action is built from. */
export interface StoreContext {
  set: StoreApi<WorkspaceState>['setState'];
  get: () => WorkspaceState;
  deps: WorkspaceDeps;
  runtime: WorkspaceRuntime;
}

export const INITIAL_WORKSPACE: WorkspaceData = {
  status: 'idle',
  loadError: null,
  diagrams: [],
  activeId: null,
  saveState: 'saved',
  histories: {},
  renamingId: null,
  isSearchFocusRequested: false,
};
