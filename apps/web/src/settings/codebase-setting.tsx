import { Button } from '@nautink/ui/components/button';
import { Input } from '@nautink/ui/components/input';
import { useEffect, useRef, useState } from 'react';

import { useRepoStore } from './repo-store.ts';

import type { RepoLoadStatus } from './repo-store.ts';
import type { ReactElement, RefObject, SyntheticEvent } from 'react';

interface RepoSummaryProps {
  repoDir: string | null;
  onChange: () => void;
}

/** The chosen folder (or None), with Choose folder / Change and Clear (M8). */
function RepoSummary({ repoDir, onChange }: RepoSummaryProps): ReactElement {
  const isSaving: boolean = useRepoStore((state) => state.isSaving);
  return (
    <div className="flex items-center justify-between gap-2 rounded-track border px-2.5 py-2">
      {repoDir === null ? (
        <span className="text-faint">None</span>
      ) : (
        // Right-to-left so a long path is cut at its start and the folder name stays in view.
        <span
          title={repoDir}
          className="min-w-0 truncate text-left font-mono text-xs [direction:rtl]"
        >
          <bdi dir="ltr">{repoDir}</bdi>
        </span>
      )}
      <span className="flex shrink-0 items-center gap-2.5">
        {repoDir === null ? null : (
          <Button
            variant="link"
            size="xs"
            className="h-auto p-0 text-muted-foreground"
            disabled={isSaving}
            onClick={() => void useRepoStore.getState().save(null)}
          >
            Clear
          </Button>
        )}
        <Button variant="link" size="xs" className="h-auto p-0" onClick={onChange}>
          {repoDir === null ? 'Choose folder' : 'Change'}
        </Button>
      </span>
    </div>
  );
}

interface RepoFormProps {
  initialPath: string;
  onDone: () => void;
}

/** Type or paste a folder path; the server checks it exists and is a folder. */
function RepoForm({ initialPath, onDone }: RepoFormProps): ReactElement {
  const [path, setPath] = useState<string>(initialPath);
  const isSaving: boolean = useRepoStore((state) => state.isSaving);
  const inputRef: RefObject<HTMLInputElement | null> = useRef<HTMLInputElement>(null);
  useEffect(() => {
    // Focus belongs in the field the user just asked to edit.
    inputRef.current?.focus();
  }, []);
  const submit = async (event: SyntheticEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (await useRepoStore.getState().save(path)) {
      onDone();
    }
  };
  return (
    <form className="flex flex-col gap-1.5" onSubmit={(event) => void submit(event)}>
      <label htmlFor="settings-codebase-path" className="sr-only">
        Folder path
      </label>
      <Input
        id="settings-codebase-path"
        ref={inputRef}
        value={path}
        placeholder="/Users/you/projects/app"
        autoComplete="off"
        spellCheck={false}
        className="h-8 font-mono text-xs"
        onChange={(event) => {
          setPath(event.target.value);
        }}
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-faint">Claude can read files in this folder.</span>
        <span className="flex gap-1">
          <Button type="button" variant="ghost" size="xs" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" size="xs" disabled={isSaving}>
            {isSaving ? 'Saving…' : 'Save'}
          </Button>
        </span>
      </div>
    </form>
  );
}

/** The codebase Claude can read (M8): shown from `GET /api/info`, saved with `POST /api/repo`. */
export function CodebaseSetting(): ReactElement {
  const repoDir: string | null = useRepoStore((state) => state.repoDir);
  const status: RepoLoadStatus = useRepoStore((state) => state.status);
  const saveError: string | null = useRepoStore((state) => state.saveError);
  const [isEditing, setEditing] = useState<boolean>(false);
  useEffect(() => {
    void useRepoStore.getState().load();
  }, []);
  const stopEditing = (): void => {
    setEditing(false);
    useRepoStore.getState().clearSaveError();
  };
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-muted-foreground">Codebase Claude can read</span>
      {isEditing ? (
        <RepoForm initialPath={repoDir ?? ''} onDone={stopEditing} />
      ) : (
        <RepoSummary
          repoDir={repoDir}
          onChange={() => {
            setEditing(true);
          }}
        />
      )}
      {saveError === null ? null : (
        <p role="alert" className="text-xs text-destructive">
          {saveError}
        </p>
      )}
      {status === 'error' && !isEditing ? (
        <p className="text-xs text-muted-foreground">
          Could not read this setting from the local server.
        </p>
      ) : null}
    </div>
  );
}
