// The unified undo/redo history of one diagram's code (PRD §3.5, §7.3), ported from v1's
// `src/editHistory.js` as pure functions over an immutable stack.
//
// `entries[0]` is the oldest kept state (the diagram as opened or created); `entries[k]` is the
// state after the step `entries[k].label`; `index` is the current state. Undo moves `index` back,
// redo moves it forward, and a new edit after an undo drops the redo branch.

/** Steps kept per diagram, plus the oldest state. */
export const EDIT_HISTORY_CAP: number = 200;

/** A typing pause this long closes a typing group, so the next keystroke starts a new step. */
export const TYPING_GROUP_MS: number = 1000;

/** The group the code editor puts keystrokes in. Paste, cut and drop use no group. */
export const TYPING_GROUP: string = 'typing';

/** What made a step. The step menu shows it next to the label. */
export type EditSource =
  | 'code'
  | 'visual'
  | 'claude'
  | 'restore'
  | 'import'
  | 'template'
  | 'duplicate'
  | 'open'
  | 'external';

/** Where the code editor's cursor was after a step, so redo can put it back. */
export interface EditSelection {
  anchorLine: number;
  anchorCol: number;
  line: number;
  col: number;
}

/** How a caller describes a change. */
export interface EditMeta {
  /** Sentence case, past tense: "Typed in code", "Claude: Add a retry". */
  label: string;
  source: EditSource;
  /** Changes in the same open group merge into one step (typing). */
  group?: string | null;
  sel?: EditSelection | null;
}

/** One state of the code and the step that led to it. */
export interface EditEntry {
  /** Unique within its stack. */
  id: number;
  code: string;
  label: string;
  source: EditSource;
  time: number;
  sel: EditSelection | null;
  group: string | null;
  /** True while later changes of the same group may still merge into this step. */
  isOpen: boolean;
}

export interface EditStack {
  entries: readonly EditEntry[];
  index: number;
  nextId: number;
}

/** The limits and the clock a change is recorded with. */
export interface RecordOptions {
  now: number;
  cap?: number;
  groupMs?: number;
}

/** The result of moving through the history. `crossed` lists the steps undone or redone. */
export interface EditJump {
  stack: EditStack;
  code: string;
  direction: 'undo' | 'redo';
  crossed: readonly EditEntry[];
}

interface EntryFields {
  id: number;
  code: string;
  meta: EditMeta;
  now: number;
}

function makeEntry({ id, code, meta, now }: EntryFields): EditEntry {
  const group: string | null = meta.group ?? null;
  return {
    id,
    code,
    label: meta.label,
    source: meta.source,
    time: now,
    sel: meta.sel ?? null,
    group,
    isOpen: group !== null,
  };
}

/** A stack whose only state is `code`, described by `meta` ("Opened", "New blank flowchart"). */
export function createEditStack(code: string, meta: EditMeta, now: number): EditStack {
  return {
    entries: [{ ...makeEntry({ id: 1, code, meta, now }), isOpen: false }],
    index: 0,
    nextId: 2,
  };
}

/** The current state. */
export function currentEntry(stack: EditStack): EditEntry {
  const entry: EditEntry | undefined = stack.entries[stack.index];
  if (entry === undefined) {
    throw new RangeError(`Edit stack index ${String(stack.index)} is outside its entries.`);
  }
  return entry;
}

/** The step undo would revert, if any. */
export function undoStep(stack: EditStack): EditEntry | undefined {
  return stack.index > 0 ? stack.entries[stack.index] : undefined;
}

/** The step redo would apply, if any. */
export function redoStep(stack: EditStack): EditEntry | undefined {
  return stack.entries[stack.index + 1];
}

function replaceAt(stack: EditStack, entry: EditEntry): EditStack {
  const entries: EditEntry[] = [...stack.entries];
  entries[stack.index] = entry;
  return { ...stack, entries };
}

function canMerge(stack: EditStack, meta: EditMeta, options: RecordOptions): boolean {
  const current: EditEntry = currentEntry(stack);
  const isTop: boolean = stack.index === stack.entries.length - 1;
  const isSameGroup: boolean =
    meta.group !== undefined && meta.group !== null && current.group === meta.group;
  const isRecent: boolean = options.now - current.time < (options.groupMs ?? TYPING_GROUP_MS);
  return isTop && stack.index > 0 && current.isOpen && isSameGroup && isRecent;
}

function mergeInto(stack: EditStack, { code, meta, now }: Omit<EntryFields, 'id'>): EditStack {
  const current: EditEntry = currentEntry(stack);
  return replaceAt(stack, { ...current, code, time: now, sel: meta.sel ?? current.sel });
}

function pushEntry(stack: EditStack, entry: EditEntry, cap: number): EditStack {
  const kept: EditEntry[] = stack.entries
    .slice(0, stack.index + 1)
    .map((item) => (item.isOpen ? { ...item, isOpen: false } : item));
  const entries: EditEntry[] = [...kept, entry].slice(-(cap + 1));
  return { entries, index: entries.length - 1, nextId: stack.nextId + 1 };
}

/**
 * Records `code` as the new current state. A change in the same open group as the current step,
 * within `groupMs` of it, merges into that step; anything else is a new step. Returns the stack
 * unchanged when `code` is already the current state.
 */
export function recordEdit(
  stack: EditStack,
  code: string,
  { meta, options }: { meta: EditMeta; options: RecordOptions },
): EditStack {
  if (currentEntry(stack).code === code) {
    return stack;
  }
  if (canMerge(stack, meta, options)) {
    return mergeInto(stack, { code, meta, now: options.now });
  }
  const entry: EditEntry = makeEntry({ id: stack.nextId, code, meta, now: options.now });
  return pushEntry(stack, entry, options.cap ?? EDIT_HISTORY_CAP);
}

/** Ends the open group, so the next change starts a new step (cursor jump, paste, blur). */
export function closeEditGroup(stack: EditStack): EditStack {
  const current: EditEntry = currentEntry(stack);
  if (!current.isOpen) {
    return stack;
  }
  return replaceAt(stack, { ...current, isOpen: false });
}

/** True when `entryId` is the newest step and the current state, so it can still be amended. */
export function canAmend(stack: EditStack, entryId: number): boolean {
  const last: number = stack.entries.length - 1;
  return stack.index === last && last > 0 && stack.entries[last]?.id === entryId;
}

/**
 * Replaces the code of step `entryId` (one Claude turn plus its auto-fix retries stays one step).
 * When the amended code equals the state before the step, the step is dropped. Throws when the
 * step is no longer the newest current one; check `canAmend` first.
 */
export function amendEdit(
  stack: EditStack,
  { entryId, code, now }: { entryId: number; code: string; now: number },
): EditStack {
  if (!canAmend(stack, entryId)) {
    throw new Error(`Edit step ${String(entryId)} is not the newest current step.`);
  }
  const before: EditEntry | undefined = stack.entries[stack.index - 1];
  if (before?.code === code) {
    return { ...stack, entries: stack.entries.slice(0, -1), index: stack.index - 1 };
  }
  return replaceAt(stack, { ...currentEntry(stack), code, time: now });
}

/** Moves to state `target`. Throws a `RangeError` for an index outside the stack. */
export function jumpEdit(stack: EditStack, target: number): EditJump {
  const entry: EditEntry | undefined = stack.entries[target];
  if (entry === undefined || !Number.isInteger(target)) {
    throw new RangeError(`No edit step at index ${String(target)}.`);
  }
  const closed: EditStack = closeEditGroup(stack);
  const direction: EditJump['direction'] = target < stack.index ? 'undo' : 'redo';
  const crossed: EditEntry[] =
    direction === 'undo'
      ? closed.entries.slice(target + 1, stack.index + 1).reverse()
      : closed.entries.slice(stack.index + 1, target + 1);
  return { stack: { ...closed, index: target }, code: entry.code, direction, crossed };
}
