import { ToggleGroup, ToggleGroupItem } from '@nautink/ui/components/toggle-group';

import type { Meta, StoryObj } from '@storybook/react-vite';

// Not `Meta<typeof ToggleGroup>`: its props are a single/multiple union, which has no shared args.
const meta: Meta = {
  title: 'Components/ToggleGroup',
  component: ToggleGroup,
};

export default meta;

type Story = StoryObj<typeof meta>;

/** The Preview / Edit / Split switch: one tab stop, the arrows move inside it. */
export const Segmented: Story = {
  render: () => (
    <ToggleGroup type="single" defaultValue="preview" variant="outline" aria-label="Canvas view">
      <ToggleGroupItem value="preview">Preview</ToggleGroupItem>
      <ToggleGroupItem value="edit">Edit</ToggleGroupItem>
      <ToggleGroupItem value="split">Split</ToggleGroupItem>
    </ToggleGroup>
  ),
};
