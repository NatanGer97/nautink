import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@nautink/ui/components/resizable';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@nautink/ui/components/sheet';
import { cn } from '@nautink/ui/lib/utils';
import { useEffect } from 'react';

import { CanvasArea } from './canvas-area.tsx';
import { CodeDrawer } from './code-drawer.tsx';
import { focusOverlayContainer } from './focus-overlay.ts';
import { PANEL_WIDTHS, SidePanel } from './side-panel.tsx';
import { PANEL_LABELS } from '../commands/shell-commands.ts';
import { useUiStore } from '../state/ui-store.ts';

import type { PanelId } from '../state/ui-prefs.ts';
import type { ReactElement } from 'react';

/** Tailwind needs whole class names, so the sheet widths mirror PANEL_WIDTHS. */
const SHEET_WIDTH_CLASS: Readonly<Record<PanelId, string>> = {
  chat: 'w-[360px]',
  diagrams: 'w-[296px]',
  history: 'w-[320px]',
};

const SHEET_MOTION: string =
  'gap-0 p-0 outline-none data-[state=closed]:duration-150 data-[state=open]:duration-200';

/** Wide windows: side panel, canvas and code drawer side by side, with draggable dividers. */
export function WideWorkspace(): ReactElement {
  const activePanel: PanelId | null = useUiStore((state) => state.activePanel);
  const isCodeDrawerOpen: boolean = useUiStore((state) => state.isCodeDrawerOpen);
  return (
    <ResizablePanelGroup orientation="horizontal" className="min-w-0 flex-1">
      {activePanel === null ? null : (
        <>
          <ResizablePanel
            key={activePanel}
            id={`panel-${activePanel}`}
            defaultSize={PANEL_WIDTHS[activePanel]}
            minSize={240}
            maxSize={560}
          >
            <SidePanel panel={activePanel} />
          </ResizablePanel>
          <ResizableHandle aria-label={`Resize ${PANEL_LABELS[activePanel].toLowerCase()}`} />
        </>
      )}
      <ResizablePanel id="canvas" minSize={320}>
        <CanvasArea />
      </ResizablePanel>
      {isCodeDrawerOpen ? (
        <>
          <ResizableHandle aria-label="Resize code" />
          <ResizablePanel id="code" defaultSize={420} minSize={320} maxSize={720}>
            <CodeDrawer />
          </ResizablePanel>
        </>
      ) : null}
    </ResizablePanelGroup>
  );
}

/**
 * Narrow windows (under 1024 px): the panel and the code drawer become sheets over the canvas.
 * Both start closed, because an overlay should never open by itself on load or on resize.
 */
export function NarrowWorkspace(): ReactElement {
  const activePanel: PanelId | null = useUiStore((state) => state.activePanel);
  const setActivePanel: (panel: PanelId | null) => void = useUiStore(
    (state) => state.setActivePanel,
  );
  const isCodeDrawerOpen: boolean = useUiStore((state) => state.isCodeDrawerOpen);
  const setCodeDrawerOpen: (isOpen: boolean) => void = useUiStore(
    (state) => state.setCodeDrawerOpen,
  );
  useEffect(() => {
    setActivePanel(null);
    setCodeDrawerOpen(false);
  }, [setActivePanel, setCodeDrawerOpen]);
  return (
    <div className="flex min-w-0 flex-1">
      <CanvasArea />
      <Sheet
        open={activePanel !== null}
        onOpenChange={(isOpen: boolean) => {
          if (!isOpen) {
            setActivePanel(null);
          }
        }}
      >
        <SheetContent
          side="left"
          showCloseButton={false}
          onOpenAutoFocus={focusOverlayContainer}
          className={cn(
            'max-w-[85vw] bg-panel sm:max-w-[85vw]',
            activePanel === null ? undefined : SHEET_WIDTH_CLASS[activePanel],
            SHEET_MOTION,
          )}
        >
          <SheetTitle className="sr-only">
            {activePanel === null ? 'Panel' : PANEL_LABELS[activePanel]}
          </SheetTitle>
          <SheetDescription className="sr-only">Side panel</SheetDescription>
          {activePanel === null ? null : <SidePanel panel={activePanel} />}
        </SheetContent>
      </Sheet>
      <Sheet open={isCodeDrawerOpen} onOpenChange={setCodeDrawerOpen}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          onOpenAutoFocus={focusOverlayContainer}
          className={`h-[60vh] ${SHEET_MOTION}`}
        >
          <SheetTitle className="sr-only">Code</SheetTitle>
          <SheetDescription className="sr-only">The diagram's Mermaid code</SheetDescription>
          <CodeDrawer />
        </SheetContent>
      </Sheet>
    </div>
  );
}
