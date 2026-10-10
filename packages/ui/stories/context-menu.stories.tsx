import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from '@nautink/ui/components/context-menu';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof ContextMenu> = {
  title: 'Components/ContextMenu',
  component: ContextMenu,
};

export default meta;

type Story = StoryObj<typeof meta>;

/** Right-click (or Shift+F10 on the focused area) opens the menu. */
export const Default: Story = {
  render: () => (
    <ContextMenu>
      <ContextMenuTrigger className="grid h-40 max-w-sm place-items-center rounded-card border border-dashed text-muted-foreground">
        Right-click here
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem>
          Rename
          <ContextMenuShortcut>F2</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem>Duplicate</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive">Delete</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  ),
};
