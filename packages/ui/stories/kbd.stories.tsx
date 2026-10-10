import { Kbd, KbdGroup } from '@nautink/ui/components/kbd';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof Kbd> = {
  title: 'Components/Kbd',
  component: Kbd,
  args: { children: 'Esc' },
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Single: Story = {};

export const Group: Story = {
  render: () => (
    <KbdGroup>
      <Kbd>⌘</Kbd>
      <Kbd>K</Kbd>
    </KbdGroup>
  ),
};
