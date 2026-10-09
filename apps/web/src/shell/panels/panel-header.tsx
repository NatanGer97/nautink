import { IconButton } from '@nautink/ui/icon-button';
import { PanelLeftClose } from 'lucide-react';

import { useUiStore } from '../../state/ui-store.ts';

import type { ReactElement, ReactNode } from 'react';

export interface PanelHeaderProps {
  title: string;
  /** A second line under the title, such as a count. */
  subtitle?: string;
  /** Buttons shown before the collapse button. */
  actions?: ReactNode;
}

/** The 44 px header every side panel shares, ending in the collapse button. */
export function PanelHeader({ title, subtitle, actions }: PanelHeaderProps): ReactElement {
  const setActivePanel: (panel: null) => void = useUiStore((state) => state.setActivePanel);
  return (
    <div className="flex min-h-11 shrink-0 items-center justify-between gap-2 border-b border-border-subtle py-1.5 pr-2 pl-4">
      <div className="flex min-w-0 flex-col">
        <h2 className="truncate font-semibold">{title}</h2>
        {subtitle === undefined ? null : (
          <span className="truncate text-xs text-muted-foreground">{subtitle}</span>
        )}
      </div>
      <div className="flex items-center gap-1">
        {actions}
        <IconButton
          label="Close panel"
          icon={<PanelLeftClose />}
          onClick={() => {
            setActivePanel(null);
          }}
        />
      </div>
    </div>
  );
}
