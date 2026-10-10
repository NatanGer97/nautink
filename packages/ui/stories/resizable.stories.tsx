import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@nautink/ui/components/resizable';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof ResizablePanelGroup> = {
  title: 'Components/Resizable',
  component: ResizablePanelGroup,
};

export default meta;

type Story = StoryObj<typeof meta>;

/** The chat and canvas split; the handle is a focusable separator the arrow keys move. */
export const TwoPanels: Story = {
  render: () => (
    <div className="h-48 max-w-xl rounded-card border">
      <ResizablePanelGroup orientation="horizontal">
        <ResizablePanel defaultSize="35%" className="grid place-items-center">
          Chat
        </ResizablePanel>
        <ResizableHandle withHandle aria-label="Resize chat" />
        <ResizablePanel className="grid place-items-center">Canvas</ResizablePanel>
      </ResizablePanelGroup>
    </div>
  ),
};
