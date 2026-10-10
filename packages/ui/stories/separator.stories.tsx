import { Separator } from '@nautink/ui/components/separator';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof Separator> = {
  title: 'Components/Separator',
  component: Separator,
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Horizontal: Story = {
  render: () => (
    <div className="max-w-xs">
      <p>Appearance</p>
      <Separator className="my-3" />
      <p>Default model</p>
    </div>
  ),
};

export const Vertical: Story = {
  render: () => (
    <div className="flex h-6 items-center gap-3">
      <span>Undo</span>
      <Separator orientation="vertical" />
      <span>Redo</span>
    </div>
  ),
};
