import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@nautink/ui/components/alert-dialog';
import { Button } from '@nautink/ui/components/button';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof AlertDialog> = {
  title: 'Components/AlertDialog',
  component: AlertDialog,
};

export default meta;

type Story = StoryObj<typeof meta>;

/** Opens on load, so the accessibility panel checks the dialog itself. */
export const Open: Story = {
  render: () => (
    <AlertDialog defaultOpen>
      <AlertDialogTrigger asChild>
        <Button variant="outline">Delete diagram</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “Checkout flow”?</AlertDialogTitle>
          <AlertDialogDescription>
            Its versions and chat go with it. You can undo this for a few seconds.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ),
};
