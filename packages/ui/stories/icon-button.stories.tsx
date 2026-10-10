import { History, MessageSquare, Settings } from 'lucide-react';

import { IconButton } from '@nautink/ui/icon-button';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof IconButton> = {
  title: 'Components/IconButton',
  component: IconButton,
  args: { label: 'History', icon: <History />, shortcut: '⌘⇧H' },
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** The open rail panel's button. */
export const Active: Story = { args: { label: 'Chat', icon: <MessageSquare />, isActive: true } };

/** Unavailable but still focusable, so its tooltip can say what it is. */
export const Disabled: Story = {
  args: { label: 'Settings', icon: <Settings />, isDisabled: true },
};
