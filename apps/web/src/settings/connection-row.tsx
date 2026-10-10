import { Button } from '@nautink/ui/components/button';
import { cn } from '@nautink/ui/lib/utils';

import type { ConnectionStatus } from './health.ts';
import type { ReactElement } from 'react';

export interface ConnectionRowProps {
  /** The CLI's name, such as `Claude Code` or `Codex CLI`. */
  title: string;
  status: ConnectionStatus;
  onRecheck: () => void;
}

const STATUS_TEXT: Readonly<Record<ConnectionStatus['kind'], string>> = {
  checking: 'Checking…',
  connected: 'Connected',
  disconnected: 'Not connected',
};

const DOT_CLASS: Readonly<Record<ConnectionStatus['kind'], string>> = {
  checking: 'bg-faint',
  connected: 'bg-success',
  disconnected: 'bg-destructive',
};

/** The agent CLI row in Settings: a status dot, the CLI version, and why it is not connected. */
export function ConnectionRow({ title, status, onRecheck }: ConnectionRowProps): ReactElement {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-muted-foreground">{title}</span>
      <div
        role="status"
        className="flex items-center justify-between rounded-track border px-2.5 py-2"
      >
        <span className="inline-flex items-center gap-2">
          <span
            aria-hidden="true"
            className={cn('size-[7px] rounded-full', DOT_CLASS[status.kind])}
          />
          {STATUS_TEXT[status.kind]}
        </span>
        {status.kind === 'connected' ? (
          <span className="font-mono text-xs text-muted-foreground">
            {status.version ?? 'unknown version'}
          </span>
        ) : null}
        {status.kind === 'disconnected' ? (
          <Button variant="link" size="xs" className="h-auto p-0" onClick={onRecheck}>
            Check again
          </Button>
        ) : null}
      </div>
      {status.kind === 'disconnected' ? (
        <p className="text-xs text-muted-foreground">{status.error}</p>
      ) : null}
    </div>
  );
}
