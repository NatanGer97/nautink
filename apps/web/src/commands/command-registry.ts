/** One action the ⌘K palette can run. Features register theirs; the palette lists them all. */
export interface AppCommand {
  /** Unique across the app, e.g. `panel.chat`. Registering a taken id throws. */
  id: string;
  /** The palette group heading, e.g. `Panels`. */
  group: string;
  /** Verb first, sentence case: "Show chat". Unique, like the id. */
  title: string;
  /** Shown on the right of the row, e.g. `⌘K`. */
  shortcut?: string;
  /** Extra words the palette search should match. */
  keywords?: readonly string[];
  isDisabled?: boolean;
  run: () => void;
}

export interface CommandRegistry {
  /** Adds the commands and returns a function that removes them again. */
  register: (commands: readonly AppCommand[]) => () => void;
  /** Every registered command, in registration order. Stable until the next change. */
  getCommands: () => readonly AppCommand[];
  subscribe: (listener: () => void) => () => void;
}

/** Ids key the registry and titles key the palette rows, so both must be unique. */
function assertUnique(
  registered: ReadonlyMap<string, AppCommand>,
  commands: readonly AppCommand[],
): void {
  const all: AppCommand[] = [...registered.values(), ...commands];
  for (const key of ['id', 'title'] as const) {
    const values: string[] = all.map((command) => command[key]);
    const duplicate: string | undefined = values.find(
      (value, index) => values.indexOf(value) !== index,
    );
    if (duplicate !== undefined) {
      throw new Error(`A command with ${key} "${duplicate}" is already registered.`);
    }
  }
}

/** A registry that notifies subscribers when commands come and go. */
class ObservableCommandRegistry implements CommandRegistry {
  private readonly registered: Map<string, AppCommand> = new Map<string, AppCommand>();
  private readonly listeners: Set<() => void> = new Set<() => void>();
  private snapshot: readonly AppCommand[] = [];

  register = (commands: readonly AppCommand[]): (() => void) => {
    assertUnique(this.registered, commands);
    for (const command of commands) {
      this.registered.set(command.id, command);
    }
    this.publish();
    return () => {
      this.unregister(commands);
    };
  };

  getCommands = (): readonly AppCommand[] => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private unregister(commands: readonly AppCommand[]): void {
    for (const command of commands) {
      if (this.registered.get(command.id) === command) {
        this.registered.delete(command.id);
      }
    }
    this.publish();
  }

  private publish(): void {
    this.snapshot = [...this.registered.values()];
    for (const listener of this.listeners) {
      listener();
    }
  }
}

/** A new, empty registry. */
export function createCommandRegistry(): CommandRegistry {
  return new ObservableCommandRegistry();
}

/** The app's one registry. */
export const commandRegistry: CommandRegistry = createCommandRegistry();
