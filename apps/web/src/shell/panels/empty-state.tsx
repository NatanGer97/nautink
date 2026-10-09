import type { ReactElement, ReactNode } from 'react';

export interface EmptyStateProps {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}

/** A calm empty state that invites the next action (PRD §6.7). */
export function EmptyState({ title, children, action }: EmptyStateProps): ReactElement {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      <p className="font-medium">{title}</p>
      <p className="max-w-64 text-xs text-muted-foreground">{children}</p>
      {action}
    </div>
  );
}
