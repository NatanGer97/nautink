import { IconButton } from '@nautink/ui/icon-button';
import { History, Layers, LayoutGrid, MessageSquare, SlidersHorizontal } from 'lucide-react';

import { PANEL_LABELS } from '../commands/shell-commands.ts';
import { SettingsPopover } from '../settings/settings-popover.tsx';
import { useUiStore } from '../state/ui-store.ts';

import type { PanelId } from '../state/ui-prefs.ts';
import type { ReactElement, ReactNode } from 'react';

const PANEL_ICONS: Readonly<Record<PanelId, ReactNode>> = {
  diagrams: <Layers />,
  chat: <MessageSquare />,
  history: <History />,
};

/** The rail order in the mockups: Diagrams, Chat, History. */
const RAIL_PANELS: readonly PanelId[] = ['diagrams', 'chat', 'history'];

/** The 52 px rail: one button per side panel, Templates, and Settings at the bottom (PRD §5). */
export function Rail(): ReactElement {
  const activePanel: PanelId | null = useUiStore((state) => state.activePanel);
  const togglePanel: (panel: PanelId) => void = useUiStore((state) => state.togglePanel);
  const setTemplatesOpen: (isOpen: boolean) => void = useUiStore((state) => state.setTemplatesOpen);
  const isSettingsOpen: boolean = useUiStore((state) => state.isSettingsOpen);
  return (
    <nav
      aria-label="Main"
      className="flex w-[52px] shrink-0 flex-col items-center gap-1 border-r bg-panel py-2.5"
    >
      {RAIL_PANELS.map((panel) => (
        <IconButton
          key={panel}
          label={PANEL_LABELS[panel]}
          icon={PANEL_ICONS[panel]}
          tooltipSide="right"
          isActive={activePanel === panel}
          aria-pressed={activePanel === panel}
          onClick={() => {
            togglePanel(panel);
          }}
        />
      ))}
      <IconButton
        label="Templates"
        icon={<LayoutGrid />}
        tooltipSide="right"
        onClick={() => {
          setTemplatesOpen(true);
        }}
      />
      <div className="flex-1" />
      <SettingsPopover>
        <IconButton
          label="Settings"
          icon={<SlidersHorizontal />}
          tooltipSide="right"
          isActive={isSettingsOpen}
        />
      </SettingsPopover>
    </nav>
  );
}
