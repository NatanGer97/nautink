import { Plus } from 'lucide-react';

import { Button } from '@nautink/ui/components/button';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof Button> = {
  title: 'Components/Button',
  component: Button,
  args: { children: 'Save version' },
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {};

export const Outline: Story = { args: { variant: 'outline' } };

export const Secondary: Story = { args: { variant: 'secondary' } };

export const Ghost: Story = { args: { variant: 'ghost' } };

export const Destructive: Story = { args: { variant: 'destructive', children: 'Delete' } };

export const Link: Story = { args: { variant: 'link', children: 'Open the docs' } };

export const Small: Story = { args: { size: 'sm' } };

export const WithIcon: Story = {
  args: {
    children: (
      <>
        <Plus aria-hidden="true" />
        New diagram
      </>
    ),
  },
};

export const IconOnly: Story = {
  args: { size: 'icon-sm', variant: 'ghost', 'aria-label': 'Add', children: <Plus /> },
};

export const Disabled: Story = { args: { disabled: true } };
