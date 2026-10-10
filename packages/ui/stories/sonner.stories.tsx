import { toast } from 'sonner';

import { Button } from '@nautink/ui/components/button';
import { Toaster } from '@nautink/ui/components/sonner';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof Toaster> = {
  title: 'Components/Sonner',
  component: Toaster,
};

export default meta;

type Story = StoryObj<typeof meta>;

/** Shows a toast on load, with the Undo action the app uses after a delete. */
export const Toast: Story = {
  render: (args, context) => (
    <>
      <Toaster {...args} theme={context.globals.theme === 'dark' ? 'dark' : 'light'} />
      <Button
        variant="outline"
        onClick={() => {
          toast('Deleted “Checkout flow”', { action: { label: 'Undo', onClick: () => undefined } });
        }}
      >
        Delete diagram
      </Button>
    </>
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Delete diagram' }));
  },
};
