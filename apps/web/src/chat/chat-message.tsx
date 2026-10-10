import { cn } from '@nautink/ui/lib/utils';
import { Check } from 'lucide-react';

import { agentName } from './agent-name.ts';
import { ChangeCard } from './change-card.tsx';
import { ChatMarkdown } from './chat-markdown-view.tsx';
import { STOPPED_MESSAGE } from './chat-reply.ts';
import { activityStep } from './claude-activity.ts';
import { hasMermaidFence, stripMermaid } from './extract-mermaid.ts';
import { WorkingDots } from './working-dots.tsx';

import type { ChatMessage } from '@nautink/storage/records';
import type { ReactElement, ReactNode } from 'react';

const MS_PER_SECOND: number = 1000;

/** "Codex · 6.2s" once the reply reports its time (M1): named by the agent that wrote it. */
function replyHeading(message: ChatMessage): string {
  const name: string = agentName(message.agent);
  const durationMs: number | null | undefined = message.meta?.durationMs;
  if (durationMs === null || durationMs === undefined) {
    return name;
  }
  return `${name} · ${(durationMs / MS_PER_SECOND).toFixed(1)}s`;
}

/** A user's message: a bubble on the muted fill. An automatic retry shows its parse error. */
export function UserMessage({ message }: { message: ChatMessage }): ReactElement {
  const isAuto: boolean = message.auto === true;
  const shown: string = isAuto ? (message.text.split('\n')[1] ?? message.text) : message.text;
  return (
    <div className="max-w-[85%] self-end rounded-card bg-muted px-3 py-[9px] leading-normal break-words whitespace-pre-wrap">
      {isAuto ? (
        <span className="mr-1.5 rounded-control border px-1.5 text-2xs text-muted-foreground">
          Fix
        </span>
      ) : null}
      {shown}
    </div>
  );
}

/** The steps Claude took, such as "Read src/app.ts" (M2). The newest one runs while streaming. */
function ToolSteps({
  tools,
  isStreaming,
}: {
  tools: readonly string[];
  isStreaming: boolean;
}): ReactElement {
  return (
    <ul aria-label="Steps" className="flex flex-col gap-1.5 text-xs text-muted-foreground">
      {tools.map((tool, index) => {
        const isRunning: boolean = isStreaming && index === tools.length - 1;
        return (
          <li key={`${String(index)}:${tool}`} className="flex items-center gap-2">
            {isRunning ? (
              <span
                aria-hidden="true"
                className="mx-[3px] size-2 animate-pulse rounded-full bg-accent-ink"
              />
            ) : (
              <Check aria-hidden="true" className="size-3.5 stroke-2 text-success" />
            )}
            <span className="min-w-0 truncate">{tool}</span>
          </li>
        );
      })}
    </ul>
  );
}

export interface AssistantMessageProps {
  message: ChatMessage;
  diagramId: string;
  messageIndex: number;
  /** Shown at the end of the reply, such as quick actions under the latest one. */
  footer?: ReactNode;
}

/** Claude's reply: heading, steps, prose, the change card and any error (M1, M2). */
export function AssistantMessage({
  message,
  diagramId,
  messageIndex,
  footer,
}: AssistantMessageProps): ReactElement {
  const isStreaming: boolean = message.streaming === true;
  const prose: string = stripMermaid(message.text);
  const hasDiagram: boolean = hasMermaidFence(message.text);
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2 text-xs text-faint">
        <span
          aria-hidden="true"
          className="grid size-[18px] place-items-center rounded-[5px] bg-foreground text-2xs font-semibold text-background"
        >
          C
        </span>
        {replyHeading(message)}
      </div>
      {message.tools !== undefined && message.tools.length > 0 ? (
        <ToolSteps tools={message.tools} isStreaming={isStreaming} />
      ) : null}
      {prose === '' ? null : <ChatMarkdown text={prose} />}
      {isStreaming && (message.tools ?? []).length === 0 ? (
        <p className="flex items-center gap-2 text-muted-foreground">
          <WorkingDots />
          {activityStep(message)}
        </p>
      ) : null}
      {hasDiagram ? (
        <ChangeCard
          diagramId={diagramId}
          messageIndex={messageIndex}
          isStreaming={isStreaming}
          review={message.review}
        />
      ) : null}
      {message.error === undefined ? null : (
        <p
          className={cn(
            'text-destructive',
            message.error === STOPPED_MESSAGE && 'text-muted-foreground',
          )}
        >
          {message.error}
        </p>
      )}
      {footer}
    </div>
  );
}
