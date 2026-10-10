import { ScrollArea } from '@nautink/ui/components/scroll-area';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof ScrollArea> = {
  title: 'Components/ScrollArea',
  component: ScrollArea,
};

export default meta;

type Story = StoryObj<typeof meta>;

const VERSION_COUNT: number = 24;

const VERSIONS: readonly string[] = [...Array(VERSION_COUNT).keys()].map(
  (index) => `Version ${String(index + 1)}`,
);

/** Rows are buttons, so the keyboard reaches and scrolls the list (WCAG 2.1.1). */
export const List: Story = {
  render: () => (
    <ScrollArea className="h-48 max-w-xs rounded-card border" aria-label="Versions">
      <ul className="grid p-1.5">
        {VERSIONS.map((version) => (
          <li key={version}>
            <button
              type="button"
              className="w-full rounded-control px-2 py-1 text-left hover:bg-muted"
            >
              {version}
            </button>
          </li>
        ))}
      </ul>
    </ScrollArea>
  ),
};
