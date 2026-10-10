import { Button } from '@nautink/ui/components/button';

import { LazyDiff } from './lazy-diff.tsx';
import { closeReplyDiff } from './reply-diff.ts';

import type { ReplyDiff } from './reply-diff.ts';
import type { ReactElement } from 'react';

/** The code drawer on a reply's "Diff": what that reply changed, read-only, until "Back to code". */
export function ReplyDiffView({ diff }: { diff: ReplyDiff }): ReactElement {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        role="status"
        className="flex shrink-0 items-center justify-between gap-2 border-b border-border-subtle bg-subtle py-1 pr-2 pl-3.5 text-xs text-muted-foreground"
      >
        <span>Changes from this reply · read-only</span>
        <Button variant="ghost" size="xs" onClick={closeReplyDiff}>
          Back to code
        </Button>
      </div>
      <LazyDiff before={diff.before} after={diff.after} label="Code changes from this reply" />
    </div>
  );
}
