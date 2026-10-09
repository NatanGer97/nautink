import { cn } from '@nautink/ui/lib/utils';

import { DiagramThumbnail } from '../mermaid/diagram-thumbnail.tsx';

import type { DiagramTemplate } from './template-data.ts';
import type { TemplateStart } from './template-gallery.ts';
import type { ReactElement } from 'react';

export interface TemplateCardProps {
  template: DiagramTemplate;
  onStart: (template: DiagramTemplate, start: TemplateStart) => void;
}

const SMALL_BUTTON_CLASS: string =
  'h-6 rounded-control border bg-panel px-2.5 text-xs text-muted-foreground hover:border-border-strong hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring';

/** One diagram type: a picture of its example, its name, kind, and how to start (M6). */
export function TemplateCard({ template, onStart }: TemplateCardProps): ReactElement {
  const titleId: string = `template-${template.id}`;
  return (
    <article
      aria-labelledby={titleId}
      className="flex flex-col overflow-hidden rounded-card border bg-panel hover:border-border-strong"
    >
      <DiagramThumbnail
        code={template.example}
        className="h-[116px] w-full rounded-none border-0 border-b border-border-subtle bg-subtle"
      />
      <div className="flex flex-col gap-1.5 px-3 pt-2.5 pb-3">
        <div className="flex items-center justify-between gap-2">
          <h3 id={titleId} className="font-medium">
            {template.name}
          </h3>
          <span
            className={cn(
              'rounded-xs px-1.5 text-2xs font-medium',
              template.hasVisualEditor
                ? 'bg-accent-wash text-accent-ink-strong'
                : 'bg-muted text-muted-foreground',
            )}
          >
            {template.hasVisualEditor ? 'Visual editor' : 'Code'}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">{template.description}</p>
        <div className="mt-0.5 flex gap-1.5">
          <button
            type="button"
            aria-label={`Use the ${template.name.toLowerCase()} example`}
            className={cn(SMALL_BUTTON_CLASS, 'text-foreground')}
            onClick={() => {
              onStart(template, 'example');
            }}
          >
            Use example
          </button>
          {template.blank === undefined ? null : (
            <button
              type="button"
              aria-label={`Start a blank ${template.name.toLowerCase()}`}
              className={SMALL_BUTTON_CLASS}
              onClick={() => {
                onStart(template, 'blank');
              }}
            >
              Blank
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
