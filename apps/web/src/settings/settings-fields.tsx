import { MODEL_IDS, MODEL_LABELS } from '@nautink/contracts/models';
import { Button } from '@nautink/ui/components/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@nautink/ui/components/select';
import { Switch } from '@nautink/ui/components/switch';
import { ToggleGroup, ToggleGroupItem } from '@nautink/ui/components/toggle-group';
import { isThemePreference, THEME_LABELS, THEME_PREFERENCES } from '@nautink/ui/theme';

import { CodebaseSetting } from './codebase-setting.tsx';
import { ConnectionRow } from './connection-row.tsx';
import { backUpAll, pickAndRestoreBackup } from '../import/import-files.ts';
import { OUTLINE_BUTTON_CLASS } from '../shell/button-styles.ts';
import { useUiStore } from '../state/ui-store.ts';
import { useWorkspaceStore } from '../workspace/use-workspace.ts';

import type { ConnectionCheck } from './use-connection-status.ts';
import type { ModelId } from '@nautink/contracts/models';
import type { ThemePreference } from '@nautink/ui/theme';
import type { ReactElement } from 'react';

/** The Select value for "use Claude Code's own default". */
const DEFAULT_MODEL_VALUE: string = 'default';

function toModel(value: string): ModelId | null {
  const model: ModelId | undefined = MODEL_IDS.find((id) => id === value);
  if (model === undefined && value !== DEFAULT_MODEL_VALUE) {
    throw new Error(`Unknown model "${value}".`);
  }
  return model ?? null;
}

/** System, Light or Dark as a segmented control (M8). */
export function AppearanceField(): ReactElement {
  const preference: ThemePreference = useUiStore((state) => state.themePreference);
  const setPreference: (value: ThemePreference) => void = useUiStore(
    (state) => state.setThemePreference,
  );
  return (
    <div className="flex flex-col gap-1.5">
      <span id="settings-appearance" className="text-xs text-muted-foreground">
        Appearance
      </span>
      <ToggleGroup
        type="single"
        spacing={0.5}
        value={preference}
        onValueChange={(value: string) => {
          if (isThemePreference(value)) {
            setPreference(value);
          }
        }}
        aria-labelledby="settings-appearance"
        className="w-full rounded-track bg-muted p-0.5"
      >
        {THEME_PREFERENCES.map((option) => (
          <ToggleGroupItem
            key={option}
            value={option}
            className="h-[26px] flex-1 rounded-control text-muted-foreground hover:bg-transparent hover:text-foreground data-[state=on]:bg-panel data-[state=on]:text-foreground data-[state=on]:shadow-segment"
          >
            {THEME_LABELS[option]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

/** The model new chats start with: Claude Code's default, or one of the named models. */
export function DefaultModelField(): ReactElement {
  const model: ModelId | null = useUiStore((state) => state.defaultModel);
  const setModel: (value: ModelId | null) => void = useUiStore((state) => state.setDefaultModel);
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="settings-model" className="text-xs text-muted-foreground">
        Default model
      </label>
      <Select
        value={model ?? DEFAULT_MODEL_VALUE}
        onValueChange={(value: string) => {
          setModel(toModel(value));
        }}
      >
        <SelectTrigger id="settings-model" size="sm" className={`w-full ${OUTLINE_BUTTON_CLASS}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={DEFAULT_MODEL_VALUE}>Default</SelectItem>
          {MODEL_IDS.map((id) => (
            <SelectItem key={id} value={id}>
              {MODEL_LABELS[id]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Whether Claude's changes wait on the canvas for Accept or Reject (PRD §4.2). */
export function ReviewChangesField(): ReactElement {
  const isOn: boolean = useUiStore((state) => state.shouldReviewChanges);
  const setReviewChanges: (isOn: boolean) => void = useUiStore((state) => state.setReviewChanges);
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="flex flex-col gap-0.5">
        <label htmlFor="settings-review" className="font-medium">
          Review changes before applying
        </label>
        <span id="settings-review-hint" className="text-xs text-muted-foreground">
          Claude&apos;s changes wait on the canvas until you accept them.
        </span>
      </span>
      <Switch
        id="settings-review"
        aria-describedby="settings-review-hint"
        className="mt-0.5"
        checked={isOn}
        onCheckedChange={setReviewChanges}
      />
    </div>
  );
}

/** The codebase Claude can read (M8). */
export function CodebaseField(): ReactElement {
  return <CodebaseSetting />;
}

/** Back up every diagram to a JSON file, or restore one (a v1 backup too, PRD §8). */
export function BackupField(): ReactElement {
  const isReady: boolean = useWorkspaceStore((state) => state.status === 'ready');
  return (
    <div className="flex gap-1.5 border-t border-border-subtle pt-3">
      <Button
        variant="outline"
        size="sm"
        className={`flex-1 ${OUTLINE_BUTTON_CLASS}`}
        disabled={!isReady}
        onClick={() => void backUpAll()}
      >
        Back up all
      </Button>
      <Button
        variant="outline"
        size="sm"
        className={`flex-1 ${OUTLINE_BUTTON_CLASS}`}
        disabled={!isReady}
        onClick={() => void pickAndRestoreBackup()}
      >
        Restore backup
      </Button>
    </div>
  );
}

/**
 * Every row of the settings popover, in order. Loaded the first time Settings opens, so the Select
 * and Switch it needs stay out of the main bundle (PRD §9).
 */
export function SettingsFields({ connection }: { connection: ConnectionCheck }): ReactElement {
  return (
    <>
      <AppearanceField />
      <DefaultModelField />
      <ReviewChangesField />
      <ConnectionRow status={connection.status} onRecheck={connection.recheck} />
      <CodebaseField />
      <BackupField />
    </>
  );
}
