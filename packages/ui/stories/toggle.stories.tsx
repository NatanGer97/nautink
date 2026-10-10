import { Toggle } from '@nautink/ui/components/toggle';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof Toggle> = {
  title: 'Components/Toggle',
  component: Toggle,
  args: { children: 'Code' },
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Off: Story = {};

export const On: Story = { args: { defaultPressed: true } };

export const Outline: Story = { args: { variant: 'outline' } };
