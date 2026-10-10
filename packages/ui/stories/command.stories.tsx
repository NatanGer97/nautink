import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@nautink/ui/components/command';

import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactElement } from 'react';

const meta: Meta<typeof Command> = {
  title: 'Components/Command',
  component: Command,
};

export default meta;

type Story = StoryObj<typeof meta>;

// No CommandSeparator: cmdk renders it inside the listbox, where ARIA allows only options and
// groups. The app's palette does not use one either.
function Items(): ReactElement {
  return (
    <>
      <CommandInput placeholder="Search or run a command" />
      <CommandList>
        <CommandEmpty>No command matches.</CommandEmpty>
        <CommandGroup heading="Panels">
          <CommandItem>
            Toggle code
            <CommandShortcut>⌘E</CommandShortcut>
          </CommandItem>
          <CommandItem>Show history</CommandItem>
        </CommandGroup>
        <CommandGroup heading="Diagram">
          <CommandItem>New diagram</CommandItem>
          <CommandItem>Rename diagram</CommandItem>
        </CommandGroup>
      </CommandList>
    </>
  );
}

export const Inline: Story = {
  render: () => (
    <Command className="max-w-md rounded-card border">
      <Items />
    </Command>
  ),
};

/** The ⌘K palette's shell, open on load. Esc closes it, so it has no close button, as in the app. */
export const Dialog: Story = {
  render: () => (
    <CommandDialog
      open
      title="Command palette"
      description="Search for a command to run"
      showCloseButton={false}
    >
      <Items />
    </CommandDialog>
  ),
};
