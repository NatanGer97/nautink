import { MODEL_IDS, MODEL_LABELS } from '@nautink/contracts/models';
import { Button } from '@nautink/ui/components/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@nautink/ui/components/select';
import { ToggleGroup, ToggleGroupItem } from '@nautink/ui/components/toggle-group';
import { isThemePreference, THEME_LABELS, THEME_PREFERENCES } from '@nautink/ui/theme';

import { OUTLINE_BUTTON_CLASS } from '../shell/button-styles.ts';
import { useUiStore } from '../state/ui-store.ts';

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

/** The codebase Claude can read. Placeholder until repo-aware mode lands. */
export function CodebaseField(): ReactElement {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-muted-foreground">Codebase Claude can read</span>
      <div className="flex items-center justify-between rounded-track border px-2.5 py-2">
        <span className="text-muted-foreground">None</span>
        <Button variant="link" size="xs" className="h-auto p-0" disabled>
          Choose folder
        </Button>
      </div>
    </div>
  );
}

/** Back up and restore every diagram. Placeholder until storage lands. */
export function BackupField(): ReactElement {
  return (
    <div className="flex gap-1.5 border-t border-border-subtle pt-3">
      <Button variant="outline" size="sm" className={`flex-1 ${OUTLINE_BUTTON_CLASS}`} disabled>
        Back up all
      </Button>
      <Button variant="outline" size="sm" className={`flex-1 ${OUTLINE_BUTTON_CLASS}`} disabled>
        Restore backup
      </Button>
    </div>
  );
}
