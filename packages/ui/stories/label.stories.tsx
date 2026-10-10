import { Label } from '@nautink/ui/components/label';
import { Switch } from '@nautink/ui/components/switch';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof Label> = {
  title: 'Components/Label',
  component: Label,
};

export default meta;

type Story = StoryObj<typeof meta>;

export const WithControl: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Switch id="review-changes" defaultChecked />
      <Label htmlFor="review-changes">Review changes before applying</Label>
    </div>
  ),
};
