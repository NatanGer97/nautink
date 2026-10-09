import { Button } from '@nautink/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@nautink/ui/components/dialog';

import { useUiStore } from '../state/ui-store.ts';

import type { ReactElement } from 'react';

/** The new-diagram gallery (M6). A seam until templates land. */
export function TemplatesDialog(): ReactElement {
  const isOpen: boolean = useUiStore((state) => state.isTemplatesOpen);
  const setOpen: (isOpen: boolean) => void = useUiStore((state) => state.setTemplatesOpen);
  const focusComposer: () => void = useUiStore((state) => state.focusComposer);
  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogContent className="rounded-dialog bg-panel shadow-dialog sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New diagram</DialogTitle>
          <DialogDescription>
            The template gallery arrives with the diagram editors. Until then, describe the diagram
            you want in chat.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            onClick={() => {
              setOpen(false);
              focusComposer();
            }}
          >
            Describe it in chat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
