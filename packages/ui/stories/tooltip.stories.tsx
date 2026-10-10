import { Button } from '@nautink/ui/components/button';
import { Kbd } from '@nautink/ui/components/kbd';
import { Tooltip, TooltipContent, TooltipTrigger } from '@nautink/ui/components/tooltip';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof Tooltip> = {
  title: 'Components/Tooltip',
  component: Tooltip,
};

export default meta;

type Story = StoryObj<typeof meta>;

/** Open on load, with the shortcut every icon button's tooltip names (PRD §6.5). */
export const Open: Story = {
  render: () => (
    <div className="p-10">
      <Tooltip defaultOpen>
        <TooltipTrigger asChild>
          <Button variant="outline">Search</Button>
        </TooltipTrigger>
        <TooltipContent className="flex items-center gap-2">
          Search or run a command
          <Kbd>⌘K</Kbd>
        </TooltipContent>
      </Tooltip>
    </div>
  ),
};
