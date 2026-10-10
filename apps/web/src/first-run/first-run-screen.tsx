import { AGENT_CLI_NAMES } from '@nautink/contracts/agents';
import { Button } from '@nautink/ui/components/button';
import { FolderOpen, LayoutGrid, Square, Upload } from 'lucide-react';
import { useEffect } from 'react';

import { FirstRunPromptBox } from './first-run-prompt-box.tsx';
import { finishFirstRun } from './first-run-store.ts';
import { useAgentName } from '../chat/agent-name.ts';
import { openFiles, pickAndRestoreBackup } from '../import/import-files.ts';
import { useUiStore } from '../state/ui-store.ts';

import type { UiState } from '../state/ui-store.ts';
import type { ReactElement, ReactNode } from 'react';

interface StartCard {
  title: string;
  label: string;
  icon: ReactNode;
  run: () => void;
}

function startCards(name: string): readonly StartCard[] {
  return [
    {
      title: 'Blank canvas',
      label: 'Pick a type, draw it yourself',
      icon: <Square />,
      run: finishFirstRun,
    },
    {
      title: 'Templates',
      label: '14 examples to adapt',
      icon: <LayoutGrid />,
      run: (): void => {
        useUiStore.getState().setTemplatesOpen(true);
      },
    },
    {
      title: 'Import',
      label: '.mmd, .md or a backup file',
      icon: <Upload />,
      run: () => void openFiles(),
    },
    {
      title: 'From a codebase',
      label: `${name} reads a local folder`,
      icon: <FolderOpen />,
      run: (): void => {
        useUiStore.getState().setSettingsOpen(true);
      },
    },
  ];
}

/** While the screen shows no panel is open; opening one from the rail leaves the screen. */
function useLeaveOnPanel(): void {
  useEffect(() => {
    useUiStore.getState().setActivePanel(null);
    return useUiStore.subscribe((state: UiState, previous: UiState) => {
      if (state.activePanel !== null && state.activePanel !== previous.activePanel) {
        finishFirstRun();
      }
    });
  }, []);
}

function StartCards(): ReactElement {
  const name: string = useAgentName();
  return (
    <section aria-labelledby="first-run-start" className="mt-4.5 flex flex-col gap-2.5">
      <h2 id="first-run-start" className="text-xs font-medium text-faint">
        Or start from
      </h2>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {startCards(name).map((card) => (
          <button
            key={card.title}
            type="button"
            className="flex flex-col items-start gap-1.5 rounded-card border bg-panel p-3 text-left hover:border-border-strong [&_svg]:size-4"
            onClick={card.run}
          >
            <span
              aria-hidden="true"
              className="grid size-7 place-items-center rounded-control bg-muted text-muted-foreground"
            >
              {card.icon}
            </span>
            <span className="font-medium">{card.title}</span>
            <span className="text-xs text-muted-foreground">{card.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

/** The first-run screen (M8): one prompt to start, or start from blank, templates, import or code. */
export function FirstRunScreen(): ReactElement {
  const name: string = useAgentName();
  const cliName: string = useUiStore((state) => AGENT_CLI_NAMES[state.agent]);
  useLeaveOnPanel();
  return (
    <main
      aria-label="Get started"
      className="flex min-w-0 flex-1 justify-center overflow-auto bg-background px-6 pt-24 pb-10"
    >
      <div className="flex w-full max-w-[680px] flex-col gap-5.5">
        <div className="flex flex-col gap-2">
          <h1 className="text-display font-semibold tracking-[-0.01em]">
            What do you want to diagram?
          </h1>
          <p className="text-base leading-relaxed text-muted-foreground">
            Describe it and {name} drafts the first version. Then edit it on the canvas, in code, or
            by asking for changes.
          </p>
        </div>
        <FirstRunPromptBox />
        <StartCards />
        <div className="mt-4 flex flex-col gap-1 text-xs text-faint">
          <p>
            Runs on your local {cliName}. Diagrams are stored in this browser; back them up from
            Settings.
          </p>
          <p>
            Coming from v1?{' '}
            <Button
              variant="link"
              size="xs"
              className="h-auto p-0 text-xs"
              onClick={() => void pickAndRestoreBackup()}
            >
              Restore its backup.
            </Button>
          </p>
        </div>
      </div>
    </main>
  );
}
