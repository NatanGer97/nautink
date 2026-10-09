import { create } from 'zustand';

import type { StoreApi, UseBoundStore } from 'zustand';

/** Assistant message index → the edit step its diagram is in, for one diagram. */
export type ReplyEdits = Readonly<Record<number, number>>;

/** The chat's session-only state. Messages and drafts live on the diagram (workspace store). */
export interface ChatData {
  /** The diagram whose reply is streaming, or `null` when Claude is idle. One reply at a time. */
  busyDiagramId: string | null;
  controller: AbortController | null;
  /** True once New chat cleared the messages of the streaming reply, so it writes nothing more. */
  isDiscarded: boolean;
  /** By diagram id. Edit steps last for the session only, and so does this. */
  replyEdits: Readonly<Record<string, ReplyEdits>>;
  /** What the polite live region reads out: a reply started, finished, stopped or failed. */
  announcement: string;
  /** The "Start a new chat?" confirmation is open (header button or ⌘K). */
  isNewChatConfirmOpen: boolean;
}

export interface ChatActions {
  begin: (diagramId: string, controller: AbortController) => void;
  end: (announcement: string) => void;
  /** Aborts the streaming reply, if any. */
  stop: () => void;
  discard: () => void;
  linkReplyEdit: (diagramId: string, link: { messageIndex: number; entryId: number }) => void;
  forgetReplyEdits: (diagramId: string) => void;
  announce: (announcement: string) => void;
  setNewChatConfirmOpen: (isOpen: boolean) => void;
}

export type ChatState = ChatData & ChatActions;

const INITIAL_CHAT: ChatData = {
  busyDiagramId: null,
  controller: null,
  isDiscarded: false,
  replyEdits: {},
  announcement: '',
  isNewChatConfirmOpen: false,
};

type SetChat = StoreApi<ChatState>['setState'];

function linkActions(set: SetChat): Pick<ChatActions, 'linkReplyEdit' | 'forgetReplyEdits'> {
  return {
    linkReplyEdit: (diagramId, { messageIndex, entryId }): void => {
      set((state) => ({
        replyEdits: {
          ...state.replyEdits,
          [diagramId]: { ...state.replyEdits[diagramId], [messageIndex]: entryId },
        },
      }));
    },
    forgetReplyEdits: (diagramId): void => {
      set((state) => ({ replyEdits: { ...state.replyEdits, [diagramId]: {} } }));
    },
  };
}

function runActions(set: SetChat): Pick<ChatActions, 'begin' | 'end' | 'announce'> {
  return {
    begin: (diagramId, controller): void => {
      set({
        busyDiagramId: diagramId,
        controller,
        isDiscarded: false,
        announcement: 'Claude is replying.',
      });
    },
    end: (announcement): void => {
      set({ busyDiagramId: null, controller: null, announcement });
    },
    announce: (announcement): void => {
      set({ announcement });
    },
  };
}

function abortActions(set: SetChat, get: () => ChatState): Pick<ChatActions, 'stop' | 'discard'> {
  return {
    stop: (): void => {
      get().controller?.abort();
    },
    discard: (): void => {
      set({ isDiscarded: true });
      get().controller?.abort();
    },
  };
}

function confirmActions(set: SetChat): Pick<ChatActions, 'setNewChatConfirmOpen'> {
  return {
    setNewChatConfirmOpen: (isOpen): void => {
      set({ isNewChatConfirmOpen: isOpen });
    },
  };
}

/** The chat's runtime state: which reply streams, its abort, and the change cards' edit steps. */
export const useChatStore: UseBoundStore<StoreApi<ChatState>> = create<ChatState>()((set, get) => ({
  ...INITIAL_CHAT,
  ...runActions(set),
  ...abortActions(set, get),
  ...linkActions(set),
  ...confirmActions(set),
}));

/** Back to idle with nothing linked. For tests. */
export function resetChatState(): void {
  useChatStore.getState().stop();
  useChatStore.setState(INITIAL_CHAT);
}
