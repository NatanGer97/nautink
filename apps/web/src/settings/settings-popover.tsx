import { Popover, PopoverContent, PopoverTrigger } from '@nautink/ui/components/popover';
import { IconButton } from '@nautink/ui/icon-button';
import { X } from 'lucide-react';
import { Suspense, lazy } from 'react';

import { useConnectionStatus } from './use-connection-status.ts';
import { focusOverlayContainer } from '../shell/focus-overlay.ts';
import { useUiStore } from '../state/ui-store.ts';

import type { ConnectionCheck } from './use-connection-status.ts';
import type { AgentId } from '@nautink/contracts/agents';
import type { ComponentType, ReactElement, ReactNode } from 'react';

const LazySettingsFields: ComponentType<{ connection: ConnectionCheck }> = lazy(async () => ({
  default: (await import('./settings-fields.tsx')).SettingsFields,
}));

export interface SettingsPopoverProps {
  /** The rail's Settings button, which the popover opens from. */
  children: ReactNode;
}

/** Settings (M8): appearance, agent, default model, change review, CLI connection, codebase and backup. */
export function SettingsPopover({ children }: SettingsPopoverProps): ReactElement {
  const isOpen: boolean = useUiStore((state) => state.isSettingsOpen);
  const setOpen: (isOpen: boolean) => void = useUiStore((state) => state.setSettingsOpen);
  const agent: AgentId = useUiStore((state) => state.agent);
  const connection: ConnectionCheck = useConnectionStatus(isOpen, agent);
  return (
    <Popover open={isOpen} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        side="right"
        align="end"
        sideOffset={8}
        aria-labelledby="settings-title"
        onOpenAutoFocus={focusOverlayContainer}
        className="flex w-80 flex-col gap-3.5 rounded-float p-3.5"
      >
        <div className="flex items-center justify-between">
          <h2 id="settings-title" className="font-semibold">
            Settings
          </h2>
          <IconButton
            label="Close settings"
            shortcut="Esc"
            icon={<X />}
            className="size-7"
            onClick={() => {
              setOpen(false);
            }}
          />
        </div>
        <Suspense fallback={<p className="text-muted-foreground">Loading settings…</p>}>
          <LazySettingsFields connection={connection} />
        </Suspense>
      </PopoverContent>
    </Popover>
  );
}
