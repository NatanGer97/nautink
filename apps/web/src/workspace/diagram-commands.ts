import { displayTitle } from './text.ts';

import type { WorkspaceState } from './workspace-state.ts';
import type { AppCommand } from '../commands/command-registry.ts';
import type { UiState } from '../state/ui-store.ts';

type GetWorkspace = () => WorkspaceState;
type GetUi = () => UiState;

/** Recent diagrams the palette offers to open (v1 offered 15). */
export const OPEN_COMMAND_LIMIT: number = 15;

/** What the diagram commands depend on; they re-register when it changes. */
export interface DiagramCommandState {
  isPinned: boolean;
  /** Other diagrams, most recent first, at most `OPEN_COMMAND_LIMIT`. */
  recent: readonly { id: string; title: string }[];
}

interface CommandSpec {
  id: string;
  title: string;
  keywords?: string[];
  isDeferred?: boolean;
  run: (workspace: WorkspaceState, activeId: string) => void;
}

/** Runs `run` on the open diagram; does nothing before the workspace has loaded. */
function onActive(getState: GetWorkspace, spec: CommandSpec): AppCommand {
  return {
    id: spec.id,
    group: 'Diagram',
    title: spec.title,
    ...(spec.keywords === undefined ? {} : { keywords: spec.keywords }),
    ...(spec.isDeferred === true ? { isDeferred: true } : {}),
    run: (): void => {
      const workspace: WorkspaceState = getState();
      if (workspace.activeId !== null) {
        spec.run(workspace, workspace.activeId);
      }
    },
  };
}

/** Titles made unique for the palette: a second "Checkout" reads "Checkout (2)". */
export function uniqueTitles(titles: readonly string[]): string[] {
  const seen: Map<string, number> = new Map<string, number>();
  return titles.map((title) => {
    const count: number = (seen.get(title) ?? 0) + 1;
    seen.set(title, count);
    return count === 1 ? title : `${title} (${String(count)})`;
  });
}

function openCommands(getState: GetWorkspace, state: DiagramCommandState): AppCommand[] {
  const titles: string[] = uniqueTitles(state.recent.map((item) => displayTitle(item.title)));
  return state.recent.map((item, index) => ({
    id: `diagram.open.${item.id}`,
    group: 'Diagrams',
    title: `Open “${titles[index] ?? item.title}”`,
    keywords: ['switch'],
    run: (): void => {
      getState().selectDiagram(item.id);
    },
  }));
}

const DUPLICATE: CommandSpec = {
  id: 'diagram.duplicate',
  title: 'Duplicate diagram',
  run: (workspace, id) => void workspace.duplicateDiagram(id),
};

const DOWNLOAD: CommandSpec = {
  id: 'diagram.download',
  title: 'Download .mmd',
  keywords: ['export', 'file'],
  run: (workspace, id) => {
    workspace.downloadDiagram(id);
  },
};

const DELETE: CommandSpec = {
  id: 'diagram.delete',
  title: 'Delete diagram',
  run: (workspace, id) => void workspace.deleteDiagram(id),
};

function pinSpec(isPinned: boolean): CommandSpec {
  return {
    id: 'diagram.pin',
    title: isPinned ? 'Unpin diagram' : 'Pin diagram',
    run: (workspace: WorkspaceState, id: string): void => {
      workspace.togglePin(id);
    },
  };
}

/** Below `md` the top bar hides the title, so rename falls back to the diagrams panel. */
const TITLE_HIDDEN_QUERY: string = '(max-width: 767.98px)';

function renameSpec(getUi: GetUi): CommandSpec {
  return {
    id: 'diagram.rename',
    title: 'Rename diagram',
    isDeferred: true,
    run: (workspace: WorkspaceState, id: string): void => {
      if (!window.matchMedia(TITLE_HIDDEN_QUERY).matches) {
        workspace.requestTitleRename();
        return;
      }
      getUi().setActivePanel('diagrams');
      workspace.startRename(id);
    },
  };
}

function searchCommand(getState: GetWorkspace, getUi: GetUi): AppCommand {
  return {
    id: 'diagram.search',
    group: 'Diagram',
    title: 'Search diagrams',
    keywords: ['find', 'filter'],
    isDeferred: true,
    run: (): void => {
      getUi().setActivePanel('diagrams');
      getState().requestSearchFocus();
    },
  };
}

function createCommand(getState: GetWorkspace): AppCommand {
  return {
    id: 'diagram.new',
    group: 'Diagram',
    title: 'New diagram',
    keywords: ['create', 'blank'],
    run: (): void => {
      void getState().createDiagram();
    },
  };
}

/** New, search, rename, duplicate, pin, download, delete, and "Open …" for recent diagrams. */
export function buildDiagramCommands(
  { getState, getUi }: { getState: GetWorkspace; getUi: GetUi },
  state: DiagramCommandState,
): AppCommand[] {
  const onOpen: CommandSpec[] = [
    renameSpec(getUi),
    DUPLICATE,
    pinSpec(state.isPinned),
    DOWNLOAD,
    DELETE,
  ];
  return [
    createCommand(getState),
    searchCommand(getState, getUi),
    ...onOpen.map((spec) => onActive(getState, spec)),
    ...openCommands(getState, state),
  ];
}
