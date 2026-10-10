import { cn } from '@nautink/ui/lib/utils';

import type { ReactElement } from 'react';

const DOT_CLASS: string =
  'size-1.5 rounded-full bg-accent-ink animate-[nautink-dot_1.2s_ease-in-out_infinite]';

/** Three teal dots that rise in turn while Claude works. Still under reduced motion. */
export function WorkingDots({ className }: { className?: string }): ReactElement {
  return (
    <span aria-hidden="true" className={cn('inline-flex items-center gap-1', className)}>
      <span className={DOT_CLASS} />
      <span className={cn(DOT_CLASS, '[animation-delay:150ms]')} />
      <span className={cn(DOT_CLASS, '[animation-delay:300ms]')} />
    </span>
  );
}
