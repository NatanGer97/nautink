import { Button } from '@nautink/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@nautink/ui/components/dialog';
import { Input } from '@nautink/ui/components/input';
import { Kbd } from '@nautink/ui/components/kbd';
import { useEffect, useRef, useState } from 'react';

import { closeSaveVersionDialog, useSaveVersionDialogStore } from './save-version-dialog-store.ts';
import { saveManualVersion } from './version-actions.ts';
import { SHORTCUTS, shortcutLabel } from '../lib/shortcuts.ts';

import type { ReactElement, RefObject, SyntheticEvent } from 'react';

/** "Save version" (⌘S): an optional name, then Save; ⌘S again saves too (as v1). */
export function SaveVersionDialog(): ReactElement {
  const isOpen: boolean = useSaveVersionDialogStore((state) => state.isOpen);
  const submitRequest: number = useSaveVersionDialogStore((state) => state.submitRequest);
  const [name, setName] = useState<string>('');
  const formRef: RefObject<HTMLFormElement | null> = useRef<HTMLFormElement>(null);
  const handledRef: RefObject<number> = useRef<number>(submitRequest);
  useEffect(() => {
    if (submitRequest !== handledRef.current) {
      handledRef.current = submitRequest;
      formRef.current?.requestSubmit();
    }
  }, [submitRequest]);
  const onSubmit = (event: SyntheticEvent<HTMLFormElement>): void => {
    event.preventDefault();
    closeSaveVersionDialog();
    void saveManualVersion(name);
  };
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(isNowOpen: boolean) => {
        if (!isNowOpen) {
          closeSaveVersionDialog();
        }
        setName('');
      }}
    >
      <DialogContent className="rounded-dialog bg-panel shadow-dialog sm:max-w-sm">
        <form ref={formRef} className="flex flex-col gap-4" onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Save version</DialogTitle>
            <DialogDescription>
              Keep the current code in history. A name is optional.
            </DialogDescription>
          </DialogHeader>
          <Input
            aria-label="Version name"
            placeholder="Name (optional)"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
            }}
          />
          <DialogFooter className="items-center sm:justify-between">
            <span className="text-xs text-muted-foreground">
              <Kbd className="font-mono">↵</Kbd> or{' '}
              <Kbd className="font-mono">{shortcutLabel(SHORTCUTS.saveVersion)}</Kbd> to save
            </span>
            <Button type="submit" size="sm">
              Save version
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
