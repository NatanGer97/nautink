import { agentName } from '../chat/agent-name.ts';

import type { Version, VersionKind } from '@nautink/storage/records';

/** Badge words per kind (v1's `KIND_LABELS`), plus the current code. */
export const KIND_LABELS: Readonly<Record<VersionKind | 'current', string>> = {
  current: 'Current',
  claude: 'Claude',
  manual: 'Saved',
  restore: 'Before restore',
};

/** A version's badge: an agent version names the agent that wrote it ("Codex"). */
export function kindLabel(version: Pick<Version, 'kind' | 'agent'>): string {
  return version.kind === 'claude' ? agentName(version.agent) : KIND_LABELS[version.kind];
}

/** The muted badge tones from M5. */
export const KIND_BADGE_CLASSES: Readonly<Record<VersionKind | 'current', string>> = {
  current: 'bg-muted text-foreground',
  claude: 'bg-accent-wash text-accent-ink',
  manual: 'bg-success-bg text-success',
  restore: 'bg-warning-bg text-warning',
};

const DAY_MS: number = 86_400_000;

const CLOCK: Intl.DateTimeFormat = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
});

const DAY: Intl.DateTimeFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const FULL: Intl.DateTimeFormat = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

/** What a row says: the name, else Claude's prompt, else what kind of snapshot it is. */
export function versionText(version: Version): string {
  if (version.label !== '' || version.prompt !== '') {
    return version.label === '' ? version.prompt : version.label;
  }
  return version.kind === 'restore' ? 'Code before a restore' : 'Unnamed version';
}

/** "10:42". */
export function clockTime(time: number): string {
  return CLOCK.format(time);
}

/** "Oct 9, 2026, 10:42 AM", for a tooltip. */
export function fullTime(time: number): string {
  return FULL.format(time);
}

function startOfDay(time: number): number {
  const date: Date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/** "Today", "Yesterday" or "Oct 2, 2026". */
export function dayLabel(time: number, now: number): string {
  const days: number = Math.round((startOfDay(now) - startOfDay(time)) / DAY_MS);
  if (days <= 0) {
    return 'Today';
  }
  return days === 1 ? 'Yesterday' : DAY.format(time);
}

/** Versions (newest first) cut into runs of the same day, each with its heading. */
export function groupByDay(
  versions: readonly Version[],
  now: number,
): { label: string; versions: Version[] }[] {
  const groups: { label: string; versions: Version[] }[] = [];
  for (const version of versions) {
    const label: string = dayLabel(version.createdAt, now);
    const last: { label: string; versions: Version[] } | undefined = groups.at(-1);
    if (last?.label === label) {
      last.versions.push(version);
    } else {
      groups.push({ label, versions: [version] });
    }
  }
  return groups;
}
