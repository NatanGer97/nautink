import { Tooltip, TooltipContent, TooltipTrigger } from '@nautink/ui/components/tooltip';
import { FolderGit2 } from 'lucide-react';
import { useEffect } from 'react';

import { useRepoStore } from './repo-store.ts';
import { folderName } from './repo.ts';
import { useAgentName } from '../chat/agent-name.ts';
import { useUiStore } from '../state/ui-store.ts';

import type { ReactElement } from 'react';

/** The top bar's badge while Claude can read a codebase (PRD §3.1). Opens settings to change it. */
export function RepoBadge(): ReactElement | null {
  const name: string = useAgentName();
  const repoDir: string | null = useRepoStore((state) => state.repoDir);
  useEffect(() => {
    if (useRepoStore.getState().status === 'idle') {
      void useRepoStore.getState().load();
    }
  }, []);
  if (repoDir === null) {
    return null;
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`Codebase: ${folderName(repoDir)}`}
          className="inline-flex h-[22px] max-w-40 shrink-0 items-center gap-1 rounded-control border px-1.5 text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 max-md:hidden"
          onClick={() => {
            useUiStore.getState().setSettingsOpen(true);
          }}
        >
          <FolderGit2 aria-hidden="true" className="size-3.5" />
          <span className="truncate">{folderName(repoDir)}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent>
        {name} can read {repoDir}
      </TooltipContent>
    </Tooltip>
  );
}
