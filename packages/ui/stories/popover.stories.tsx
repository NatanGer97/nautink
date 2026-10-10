import { Button } from '@nautink/ui/components/button';
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@nautink/ui/components/popover';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof Popover> = {
  title: 'Components/Popover',
  component: Popover,
};

export default meta;

type Story = StoryObj<typeof meta>;

/** Open on load, so the accessibility panel checks the content. */
export const Open: Story = {
  render: () => (
    <Popover defaultOpen>
      <PopoverTrigger asChild>
        <Button variant="outline">Model</Button>
      </PopoverTrigger>
      <PopoverContent align="start">
        <PopoverHeader>
          <PopoverTitle>Model</PopoverTitle>
          <PopoverDescription>
            Claude Code’s own default is used until you pick one.
          </PopoverDescription>
        </PopoverHeader>
      </PopoverContent>
    </Popover>
  ),
};
