import { Button } from '@nautink/ui/components/button';
import { cn } from '@nautink/ui/lib/utils';

import type { ReactElement, ReactNode } from 'react';

export interface InspectorCardProps {
  /** "Node", "2 nodes", "Link", "Group". */
  title: string;
  /** The item's id or names, shown faint on the right. */
  subtitle?: string;
  /** Read-only disables every field and action inside. */
  isReadOnly: boolean;
  children: ReactNode;
}

/** The floating inspector in the canvas's top-right corner (M1): 248 px, tokens only. */
export function InspectorCard({
  title,
  subtitle,
  isReadOnly,
  children,
}: InspectorCardProps): ReactElement {
  return (
    <section
      aria-label="Inspector"
      className="absolute top-4 right-4 z-10 flex max-h-[calc(100%-32px)] w-[248px] @max-[40rem]:top-[68px] @max-[40rem]:max-h-[calc(100%-84px)] flex-col gap-3.5 overflow-y-auto rounded-float border bg-panel p-3.5 shadow-float"
    >
      <header className="flex min-w-0 items-baseline justify-between gap-2">
        <h2 className="shrink-0 font-semibold">{title}</h2>
        {subtitle === undefined ? null : (
          <span className="min-w-0 truncate font-mono text-xs text-faint">{subtitle}</span>
        )}
      </header>
      <fieldset disabled={isReadOnly} className="flex min-w-0 flex-col gap-3.5">
        {children}
      </fieldset>
    </section>
  );
}

/** A labelled group of controls inside the inspector. */
export function InspectorSection({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}): ReactElement {
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

/** The inspector's bottom row of actions (Group, Delete …). */
export function InspectorActions({ children }: { children: ReactNode }): ReactElement {
  return (
    <div className="flex flex-wrap gap-1.5 border-t border-border-subtle pt-3">{children}</div>
  );
}

export interface InspectorButtonProps {
  children: ReactNode;
  onClick: () => void;
  isDestructive?: boolean;
}

export function InspectorButton({
  children,
  onClick,
  isDestructive = false,
}: InspectorButtonProps): ReactElement {
  return (
    <Button
      variant="outline"
      size="sm"
      className={cn('flex-1 justify-center', isDestructive && 'text-destructive')}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
