import type { MermaidError } from '../mermaid/validate.ts';
import type { ReactElement, ReactNode } from 'react';

/** "Parse error on line 3", or without the line when Mermaid names none. */
export function parseErrorTitle(error: MermaidError): string {
  return error.line === null ? 'Parse error' : `Parse error on line ${String(error.line)}`;
}

/** What the live region reads out when the code stops parsing. */
export function parseErrorAnnouncement(error: MermaidError | null): string {
  if (error === null) {
    return '';
  }
  const firstLine: string = error.message.split('\n')[0] ?? '';
  return `${parseErrorTitle(error)}. ${firstLine}`;
}

export interface ParseErrorNoticeProps {
  error: MermaidError;
  /** True when the canvas still shows the last good render under the notice. */
  hasLastRender: boolean;
  /** Extra actions, such as "Show in code". */
  actions?: ReactNode;
}

/** The floating card over the canvas while the code does not parse (v1's `.parse-error`). */
export function ParseErrorNotice({
  error,
  hasLastRender,
  actions,
}: ParseErrorNoticeProps): ReactElement {
  return (
    <section
      aria-label="Parse error"
      className="absolute top-4 left-4 flex w-[min(440px,calc(100%-32px))] flex-col gap-1.5 rounded-card border border-destructive/40 bg-panel px-3 py-2.5 shadow-float"
    >
      <h2 className="flex items-center gap-2 text-sm font-medium text-destructive">
        <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-destructive" />
        {parseErrorTitle(error)}
      </h2>
      <pre className="max-h-32 overflow-auto font-mono text-xs whitespace-pre-wrap text-foreground">
        {error.message}
      </pre>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-faint">
          {hasLastRender ? 'Showing the last good render.' : 'Nothing rendered yet.'}
        </p>
        {actions}
      </div>
    </section>
  );
}
