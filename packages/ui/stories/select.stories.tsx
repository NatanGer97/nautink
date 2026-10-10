import { Label } from '@nautink/ui/components/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@nautink/ui/components/select';

import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactElement } from 'react';

const meta: Meta<typeof Select> = {
  title: 'Components/Select',
  component: Select,
};

export default meta;

type Story = StoryObj<typeof meta>;

function ModelSelect({ isOpen }: { isOpen: boolean }): ReactElement {
  return (
    <div className="grid max-w-xs gap-2">
      <Label htmlFor="default-model">Default model</Label>
      <Select defaultValue="default" defaultOpen={isOpen}>
        <SelectTrigger id="default-model" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Models</SelectLabel>
            <SelectItem value="default">Claude Code’s default</SelectItem>
            <SelectItem value="sonnet">Sonnet</SelectItem>
            <SelectItem value="opus">Opus</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}

export const Closed: Story = { render: () => <ModelSelect isOpen={false} /> };

export const Open: Story = {
  render: () => <ModelSelect isOpen />,
  // Radix hides the rest of the page from assistive tech while the list is open, and traps focus in
  // the list, so the trigger behind it cannot be reached. axe cannot see the trap.
  parameters: { a11y: { config: { rules: [{ id: 'aria-hidden-focus', enabled: false }] } } },
};
