import { parseMarkdown } from './chat-markdown.ts';

import type { Block, Inline } from './chat-markdown.ts';
import type { ReactElement, ReactNode } from 'react';

function renderInlines(inlines: readonly Inline[]): ReactNode[] {
  return inlines.map((inline: Inline, index: number) => (
    <InlineView key={`${String(index)}:${inline.kind}`} inline={inline} />
  ));
}

function InlineView({ inline }: { inline: Inline }): ReactElement {
  switch (inline.kind) {
    case 'text':
      return <>{inline.text}</>;
    case 'strong':
      return <strong className="font-semibold">{renderInlines(inline.children)}</strong>;
    case 'em':
      return <em>{renderInlines(inline.children)}</em>;
    case 'code':
      return (
        <code className="rounded-[4px] bg-muted px-1 py-px font-mono text-code">{inline.text}</code>
      );
    case 'link':
      return (
        <a
          href={inline.href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent-ink underline underline-offset-2"
        >
          {renderInlines(inline.children)}
        </a>
      );
  }
}

function BlockView({ block }: { block: Block }): ReactElement {
  switch (block.kind) {
    case 'paragraph':
      return <p className="whitespace-pre-wrap">{renderInlines(block.inlines)}</p>;
    case 'heading':
      return <p className="font-semibold">{renderInlines(block.inlines)}</p>;
    case 'code':
      return (
        <pre className="overflow-x-auto rounded-control bg-muted px-2.5 py-2 font-mono text-code">
          <code>{block.text}</code>
        </pre>
      );
    case 'list':
      return <ListView block={block} />;
  }
}

function ListView({ block }: { block: Extract<Block, { kind: 'list' }> }): ReactElement {
  const items: ReactNode[] = block.items.map((item: Inline[], index: number) => (
    <li key={String(index)}>{renderInlines(item)}</li>
  ));
  return block.isOrdered ? (
    <ol className="list-decimal space-y-1 pl-5">{items}</ol>
  ) : (
    <ul className="list-disc space-y-1 pl-5">{items}</ul>
  );
}

/** Claude's reply text with its Markdown (bold, lists, code, links) drawn, never as raw HTML. */
export function ChatMarkdown({ text }: { text: string }): ReactElement {
  return (
    <div className="flex flex-col gap-2 leading-relaxed break-words">
      {parseMarkdown(text).map((block: Block, index: number) => (
        <BlockView key={`${String(index)}:${block.kind}`} block={block} />
      ))}
    </div>
  );
}
