import { ChatPanel } from './panels/chat-panel.tsx';
import { DiagramsPanel } from './panels/diagrams-panel.tsx';
import { HistoryPanel } from './panels/history-panel.tsx';
import { PANEL_LABELS } from '../commands/shell-commands.ts';

import type { PanelId } from '../state/ui-prefs.ts';
import type { ReactElement } from 'react';

/** Default widths in px from PRD §5: Chat 360, Diagrams 296, History 320. */
export const PANEL_WIDTHS: Readonly<Record<PanelId, number>> = {
  chat: 360,
  diagrams: 296,
  history: 320,
};

const PANEL_CONTENT: Readonly<Record<PanelId, () => ReactElement>> = {
  chat: ChatPanel,
  diagrams: DiagramsPanel,
  history: HistoryPanel,
};

export interface SidePanelProps {
  panel: PanelId;
}

/** The open rail panel, as an `aside` landmark named after it. */
export function SidePanel({ panel }: SidePanelProps): ReactElement {
  const Content: () => ReactElement = PANEL_CONTENT[panel];
  return (
    <aside aria-label={PANEL_LABELS[panel]} className="flex h-full flex-col bg-panel">
      <Content />
    </aside>
  );
}
