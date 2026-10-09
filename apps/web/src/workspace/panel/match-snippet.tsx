import type { LineMatch } from '@nautink/storage/search';
import type { ReactElement } from 'react';

/** Matches further in than this keep only a little text before them, so they stay visible. */
const LEAD_LIMIT: number = 18;
const LEAD_KEPT: number = 12;

/** The code line a search matched, with the match marked (v1's sidebar snippet). */
export function MatchSnippet({ match }: { match: LineMatch }): ReactElement {
  const { line, start, end } = match;
  const from: number = start > LEAD_LIMIT ? start - LEAD_KEPT : 0;
  return (
    <span className="truncate font-mono text-2xs text-muted-foreground" title={line}>
      {from > 0 ? '…' : null}
      {line.slice(from, start)}
      <mark className="rounded-xs bg-accent-wash text-accent-ink-strong">
        {line.slice(start, end)}
      </mark>
      {line.slice(end)}
    </span>
  );
}
