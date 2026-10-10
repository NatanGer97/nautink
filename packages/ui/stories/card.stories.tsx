import { Button } from '@nautink/ui/components/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@nautink/ui/components/card';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof Card> = {
  title: 'Components/Card',
  component: Card,
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Card className="max-w-sm">
      <CardHeader>
        <CardTitle>Checkout flow</CardTitle>
        <CardDescription>Flowchart · edited 2 min ago</CardDescription>
        <CardAction>
          <Button variant="outline" size="sm">
            Open
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>Twelve shapes and fourteen links.</CardContent>
      <CardFooter className="text-muted-foreground">3 versions</CardFooter>
    </Card>
  ),
};
