import { Button } from '@nautink/ui/components/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@nautink/ui/components/dialog';
import { Input } from '@nautink/ui/components/input';
import { Label } from '@nautink/ui/components/label';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof Dialog> = {
  title: 'Components/Dialog',
  component: Dialog,
};

export default meta;

type Story = StoryObj<typeof meta>;

/** Opens on load, so the accessibility panel checks the dialog itself. */
export const Open: Story = {
  render: () => (
    <Dialog defaultOpen>
      <DialogTrigger asChild>
        <Button variant="outline">Save version</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save version</DialogTitle>
          <DialogDescription>Name this point in the diagram’s history.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="version-name">Version name</Label>
          <Input id="version-name" defaultValue="First draft" />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};
