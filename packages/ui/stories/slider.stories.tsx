import { Label } from '@nautink/ui/components/label';
import { Slider } from '@nautink/ui/components/slider';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof Slider> = {
  title: 'Components/Slider',
  component: Slider,
};

export default meta;

type Story = StoryObj<typeof meta>;

const SCALE: number = 2;

export const Default: Story = {
  render: () => (
    <div className="grid max-w-xs gap-3">
      <Label id="png-scale">PNG scale</Label>
      <Slider aria-labelledby="png-scale" defaultValue={[SCALE]} min={1} max={4} step={1} />
    </div>
  ),
};
