import { fileSlug } from '@nautink/storage/diagram-files';
import { Button } from '@nautink/ui/components/button';
import { IconButton } from '@nautink/ui/icon-button';
import { X } from 'lucide-react';
import { toast } from 'sonner';

import { useAgentName } from '../chat/agent-name.ts';
import { useChatStore } from '../chat/chat-store.ts';
import { CodeEditor } from '../code/code-editor.tsx';
import { useViewedVersion } from '../history/viewed-version.ts';
import { CodeReview } from '../review/code-review.tsx';
import { ReplyDiffView } from '../review/reply-diff-view.tsx';
import { useShownReplyDiff } from '../review/reply-diff.ts';
import { useOpenProposal, useReviewReadOnlyReason } from '../review/use-review.ts';
import { useUiStore } from '../state/ui-store.ts';
import { useActiveDiagram } from '../workspace/use-workspace.ts';

import type { ReplyDiff } from '../review/reply-diff.ts';
import type { Proposal } from '../review/review-store.ts';
import type { Diagram, Version } from '@nautink/storage/records';
import type { ReactElement } from 'react';

/** Shown over the code while the agent's reply streams into it (PRD §4.3). */
function agentEditingCode(name: string): string {
  return `${name} is editing… The code is read-only until the reply ends.`;
}

async function copyCode(code: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(code);
    toast('Code copied');
  } catch (err) {
    toast.error(`Could not copy the code: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/** Shown over a saved version's code while the history panel views it (M5). */
const VIEWING_VERSION: string = 'Viewing an older version · read-only';

/** Why the code cannot be edited now: Claude is replying, or an older version is on view. */
function readOnlyReason(editingAgent: string | null, viewed: Version | null): string | null {
  if (viewed !== null) {
    return VIEWING_VERSION;
  }
  return editingAgent === null ? null : agentEditingCode(editingAgent);
}

/** What replaces the code while no version is on view: Claude's open proposal, or a reply's diff. */
function useDrawerDiff(diagramId: string | undefined, viewed: Version | null): ReactElement | null {
  const proposal: Proposal | undefined = useOpenProposal(diagramId);
  const replyDiff: ReplyDiff | null = useShownReplyDiff(diagramId);
  if (viewed !== null) {
    return null;
  }
  if (proposal !== undefined) {
    return <CodeReview proposal={proposal} />;
  }
  return replyDiff === null ? null : <ReplyDiffView diff={replyDiff} />;
}

function DrawerBody({ diagram }: { diagram: Diagram | undefined }): ReactElement {
  const busyDiagramId: string | null = useChatStore((state) => state.busyDiagramId);
  const viewed: Version | null = useViewedVersion();
  const reviewReason: string | null = useReviewReadOnlyReason(diagram?.id);
  const diff: ReactElement | null = useDrawerDiff(diagram?.id, viewed);
  const name: string = useAgentName();
  if (diagram === undefined) {
    return <p className="px-3.5 py-2.5 text-muted-foreground">Opening your diagrams…</p>;
  }
  if (diff !== null) {
    return diff;
  }
  const reason: string | null = readOnlyReason(busyDiagramId === diagram.id ? name : null, viewed);
  return (
    <CodeEditor
      diagramId={diagram.id}
      code={diagram.code}
      viewed={viewed === null ? null : { id: viewed.id, code: viewed.code }}
      readOnlyReason={viewed === null ? (reviewReason ?? reason) : reason}
    />
  );
}

/** The code drawer on the right of the canvas (M3): the open diagram's Mermaid in Monaco. */
export function CodeDrawer(): ReactElement {
  const setCodeDrawerOpen: (isOpen: boolean) => void = useUiStore(
    (state) => state.setCodeDrawerOpen,
  );
  const diagram: Diagram | undefined = useActiveDiagram();
  return (
    <section aria-label="Code" className="flex h-full flex-col bg-panel">
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-border-subtle pr-2 pl-3.5">
        <span className="flex min-w-0 items-center gap-2">
          <h2 className="font-semibold">Code</h2>
          <span className="truncate text-xs text-muted-foreground">
            {`${fileSlug(diagram?.title ?? '')}.mmd`}
          </span>
        </span>
        <span className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="xs"
            disabled={diagram === undefined}
            onClick={() => {
              void copyCode(diagram?.code ?? '');
            }}
          >
            Copy
          </Button>
          <IconButton
            label="Close code"
            icon={<X />}
            onClick={() => {
              setCodeDrawerOpen(false);
            }}
          />
        </span>
      </div>
      <DrawerBody diagram={diagram} />
    </section>
  );
}
