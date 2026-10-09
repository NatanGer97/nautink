import { useEffect, useRef } from 'react';

import { finishFirstRun, useFirstRunStore } from './first-run-store.ts';
import { isUntouchedWorkspace } from '../workspace/untouched.ts';
import { useWorkspaceStore } from '../workspace/use-workspace.ts';

import type { RefObject } from 'react';

/**
 * True while the first-run screen shows (PRD §4.5): the workspace holds only the untouched blank
 * diagram of a first start, and the screen has not been left before. Once anything changes the
 * workspace (an import, a template, a new diagram), the screen is done for good.
 */
export function useIsFirstRun(): boolean {
  const isDone: boolean = useFirstRunStore((state) => state.isDone);
  const isUntouched: boolean = useWorkspaceStore(
    (state) => state.status === 'ready' && isUntouchedWorkspace(state.diagrams),
  );
  const isVisible: boolean = !isDone && isUntouched;
  const wasVisibleRef: RefObject<boolean> = useRef<boolean>(false);
  useEffect(() => {
    if (isVisible) {
      wasVisibleRef.current = true;
    } else if (wasVisibleRef.current && !isDone) {
      finishFirstRun();
    }
  }, [isVisible, isDone]);
  return isVisible;
}
