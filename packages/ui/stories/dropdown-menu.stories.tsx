import { Button } from '@nautink/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@nautink/ui/components/dropdown-menu';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof DropdownMenu> = {
  title: 'Components/DropdownMenu',
  component: DropdownMenu,
};

export default meta;

type Story = StoryObj<typeof meta>;

/** The Export menu's shape, open on load. */
export const Open: Story = {
  // Radix hides the rest of the page from assistive tech while the menu is open, and traps focus in
  // the menu, so the trigger behind it cannot be reached. axe cannot see the trap.
  parameters: { a11y: { config: { rules: [{ id: 'aria-hidden-focus', enabled: false }] } } },
  render: () => (
    <DropdownMenu defaultOpen>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">Export</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuLabel>Export as</DropdownMenuLabel>
        <DropdownMenuItem>
          SVG
          <DropdownMenuShortcut>⇧⌘S</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem>PNG</DropdownMenuItem>
        <DropdownMenuItem>Mermaid (.mmd)</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem checked>Transparent background</DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};
