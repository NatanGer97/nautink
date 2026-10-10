import { Input } from '@nautink/ui/components/input';
import { Label } from '@nautink/ui/components/label';

import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import type { ReactElement } from 'react';

/** Puts the control next to its label, as every form field in the app has one. */
const withLabel: Decorator = (renderStory): ReactElement => (
  <div className="grid max-w-xs gap-2">
    <Label htmlFor="diagram-title">Diagram title</Label>
    {renderStory()}
  </div>
);

const meta: Meta<typeof Input> = {
  title: 'Components/Input',
  component: Input,
  args: { id: 'diagram-title', placeholder: 'Untitled diagram' },
  decorators: [withLabel],
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const Filled: Story = { args: { defaultValue: 'Checkout flow' } };

export const Invalid: Story = { args: { defaultValue: '', 'aria-invalid': true } };

export const Disabled: Story = { args: { disabled: true } };
