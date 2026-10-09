import { Rail } from './rail.tsx';
import { StatusBar } from './status-bar.tsx';
import { TopBar } from './top-bar.tsx';
import { NarrowWorkspace, WideWorkspace } from './workspace.tsx';
import { FirstRunScreen } from '../first-run/first-run-screen.tsx';
import { useIsFirstRun } from '../first-run/use-first-run.ts';
import { NARROW_QUERY, useMediaQuery } from '../lib/use-media-query.ts';
import { useIsFocusMode } from '../preview/focus-mode.ts';

import type { ReactElement } from 'react';

/** The app frame from PRD §5: top bar, rail, workspace (or the first-run screen), status bar. */
export function AppShell(): ReactElement {
  const isNarrow: boolean = useMediaQuery(NARROW_QUERY);
  const isFirstRun: boolean = useIsFirstRun();
  const isFocusMode: boolean = useIsFocusMode();
  const workspace: ReactElement = isNarrow ? <NarrowWorkspace /> : <WideWorkspace />;
  return (
    <div className="flex h-full flex-col">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        {isFocusMode ? null : <Rail />}
        {isFirstRun ? <FirstRunScreen /> : workspace}
      </div>
      <StatusBar />
    </div>
  );
}
