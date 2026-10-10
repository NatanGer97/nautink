import { Skeleton } from '@nautink/ui/components/skeleton';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof Skeleton> = {
  title: 'Components/Skeleton',
  component: Skeleton,
};

export default meta;

type Story = StoryObj<typeof meta>;

/** A template card while its thumbnail renders. */
export const Card: Story = {
  render: () => (
    <div className="grid max-w-xs gap-2">
      <Skeleton className="h-28 w-full rounded-card" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-3 w-1/3" />
    </div>
  ),
};
