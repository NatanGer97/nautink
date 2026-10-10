import { Button } from '@nautink/ui/components/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@nautink/ui/components/sheet';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof Sheet> = {
  title: 'Components/Sheet',
  component: Sheet,
};

export default meta;

type Story = StoryObj<typeof meta>;

/** A narrow-screen panel, open on load. */
export const Open: Story = {
  render: () => (
    <Sheet defaultOpen>
      <SheetTrigger asChild>
        <Button variant="outline">History</Button>
      </SheetTrigger>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>History</SheetTitle>
          <SheetDescription>Every saved and automatic version of this diagram.</SheetDescription>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  ),
};
