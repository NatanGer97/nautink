import { Label } from '@nautink/ui/components/label';
import { Switch } from '@nautink/ui/components/switch';

import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import type { ReactElement } from 'react';

/** Puts the control next to its label, as every form field in the app has one. */
const withLabel: Decorator = (renderStory): ReactElement => (
  <div className="flex items-center gap-2">
    {renderStory()}
    <Label htmlFor="switch">Review changes before applying</Label>
  </div>
);

const meta: Meta<typeof Switch> = {
  title: 'Components/Switch',
  component: Switch,
  args: { id: 'switch' },
  decorators: [withLabel],
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Off: Story = {};

export const On: Story = { args: { defaultChecked: true } };

export const Disabled: Story = { args: { disabled: true } };
