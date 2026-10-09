import { Popover, PopoverContent, PopoverTrigger } from '@nautink/ui/components/popover';
import { IconButton } from '@nautink/ui/icon-button';
import { X } from 'lucide-react';

import { ConnectionRow } from './connection-row.tsx';
import {
  AppearanceField,
  BackupField,
  CodebaseField,
  DefaultModelField,
} from './settings-fields.tsx';
import { useConnectionStatus } from './use-connection-status.ts';
import { focusOverlayContainer } from '../shell/focus-overlay.ts';
import { useUiStore } from '../state/ui-store.ts';

import type { ConnectionCheck } from './use-connection-status.ts';
import type { ReactElement, ReactNode } from 'react';

export interface SettingsPopoverProps {
  /** The rail's Settings button, which the popover opens from. */
  children: ReactNode;
}

/** Settings (M8): appearance, default model, Claude Code connection, codebase and backup. */
export function SettingsPopover({ children }: SettingsPopoverProps): ReactElement {
  const isOpen: boolean = useUiStore((state) => state.isSettingsOpen);
  const setOpen: (isOpen: boolean) => void = useUiStore((state) => state.setSettingsOpen);
  const connection: ConnectionCheck = useConnectionStatus(isOpen);
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
        <AppearanceField />
        <DefaultModelField />
        <ConnectionRow status={connection.status} onRecheck={connection.recheck} />
        <CodebaseField />
        <BackupField />
      </PopoverContent>
    </Popover>
  );
}
