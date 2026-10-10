import { AGENT_IDS } from '@nautink/contracts/agents';

import { agentName } from '../../chat/agent-name.ts';
import { proposingText, reviewingText } from '../../review/use-review.ts';
import { agentEditingText, VIEWING_VERSION } from '../read-only-reason.ts';

import type { ReactElement } from 'react';

/** Reasons another bar already explains: the version bar, Claude's working pill, the proposal bar. */
const EXPLAINED_ELSEWHERE: ReadonlySet<string> = new Set<string>([
  VIEWING_VERSION,
  ...AGENT_IDS.map(agentName).flatMap((name: string) => [
    agentEditingText(name),
    proposingText(name),
    reviewingText(name),
  ]),
]);

/** Says why the canvas is read-only (a syntax error), unless another bar already says so. */
export function ReadOnlyBanner({ reason }: { reason: string | null }): ReactElement | null {
  if (reason === null || EXPLAINED_ELSEWHERE.has(reason)) {
    return null;
  }
  return (
    <p
      role="status"
      className="absolute top-4 left-1/2 z-10 max-w-[min(420px,calc(100%-32px))] -translate-x-1/2 rounded-card border bg-panel px-3 py-1.5 text-center text-xs text-muted-foreground shadow-float"
    >
      {reason}
    </p>
  );
}

/** A quiet hint in the middle of an empty canvas ("Drag a shape from the toolbar to start"). */
export function CanvasHint({ text }: { text: string }): ReactElement {
  return (
    <p className="pointer-events-none absolute inset-x-0 top-1/2 z-0 -translate-y-1/2 text-center text-muted-foreground">
      {text}
    </p>
  );
}
