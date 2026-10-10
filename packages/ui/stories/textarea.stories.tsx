import { Label } from '@nautink/ui/components/label';
import { Textarea } from '@nautink/ui/components/textarea';

import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import type { ReactElement } from 'react';

/** Puts the control next to its label, as every form field in the app has one. */
const withLabel: Decorator = (renderStory): ReactElement => (
  <div className="grid max-w-sm gap-2">
    <Label htmlFor="message">Message Claude</Label>
    {renderStory()}
  </div>
);

const meta: Meta<typeof Textarea> = {
  title: 'Components/Textarea',
  component: Textarea,
  args: { id: 'message', placeholder: 'Describe a diagram or a change' },
  decorators: [withLabel],
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const Filled: Story = { args: { defaultValue: 'Add a retry loop after the payment step' } };

export const Disabled: Story = { args: { disabled: true } };
