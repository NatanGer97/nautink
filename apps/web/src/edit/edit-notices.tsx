import { Button } from '@nautink/ui/components/button';

import { noEditorMessage } from './canvas-views.ts';
import { useUiStore } from '../state/ui-store.ts';
import { useWorkspaceStore } from '../workspace/use-workspace.ts';

import type { ReactElement, ReactNode } from 'react';

interface CenteredNoticeProps {
  message: string;
  children: ReactNode;
}

/** A calm message in the middle of the canvas, with the actions that help. */
export function CenteredNotice({ message, children }: CenteredNoticeProps): ReactElement {
  return (
    <div role="status" className="grid h-full place-items-center p-6 text-center">
      <div className="flex max-w-80 flex-col items-center gap-3">
        <p className="text-muted-foreground">{message}</p>
        <div className="flex flex-wrap justify-center gap-2">{children}</div>
      </div>
    </div>
  );
}

function OpenCodeButton(): ReactElement {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        useUiStore.getState().setCodeDrawerOpen(true);
      }}
    >
      Open code
    </Button>
  );
}

export interface NoEditorNoticeProps {
  diagramId: string;
  code: string;
}

/** Edit mode for a type without a visual editor (gantt, pie, …): say so and offer the way out. */
export function NoEditorNotice({ diagramId, code }: NoEditorNoticeProps): ReactElement {
  return (
    <CenteredNotice message={noEditorMessage(code)}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          useWorkspaceStore.getState().setView(diagramId, 'preview');
        }}
      >
        Show preview
      </Button>
      <OpenCodeButton />
    </CenteredNotice>
  );
}

/** Edit mode for a diagram with no code yet. */
export function EmptyDiagramNotice(): ReactElement {
  return (
    <CenteredNotice message="This diagram is empty. Describe one in chat, or start from a template.">
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          useUiStore.getState().setTemplatesOpen(true);
        }}
      >
        Browse templates
      </Button>
      <OpenCodeButton />
    </CenteredNotice>
  );
}
