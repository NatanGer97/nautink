import { Badge } from '@nautink/ui/components/badge';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof Badge> = {
  title: 'Components/Badge',
  component: Badge,
  args: { children: 'Flowchart' },
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Secondary: Story = { args: { variant: 'secondary' } };

export const Outline: Story = { args: { variant: 'outline', children: 'Auto' } };

export const Destructive: Story = { args: { variant: 'destructive', children: 'Invalid' } };

export const Ghost: Story = { args: { variant: 'ghost' } };
