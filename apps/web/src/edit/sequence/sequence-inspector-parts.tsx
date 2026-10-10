// Pieces the sequence inspector panels share: a participant picker, the kind grid, "Wrap in" and a
// color field (v1's `ActorSelect`, kind grid, `WrapButtons` and `ColorField`).
import { BLOCKS, KIND_NAMES, KINDS } from '@nautink/editors/sequence/constants';
import { cn } from '@nautink/ui/lib/utils';

import { KindIcon } from './sequence-glyphs.tsx';
import { WRAP_KINDS } from './sequence-library.tsx';
import { InspectorSection } from '../canvas/inspector-card.tsx';
import { CommitField, SelectField } from '../canvas/inspector-fields.tsx';

import type { SelectOption } from '../canvas/inspector-fields.tsx';
import type { BlockKind, ParticipantKind, SequenceModel } from '@nautink/editors/sequence/types';
import type { ReactElement, ReactNode } from 'react';

const HEX_RADIX: number = 16;
const HEX_DIGITS: number = 2;
const FALLBACK_COLOR: string = '#8080ff';
/** Where red, green and blue start in `#rrggbb`. */
const CHANNEL_STARTS: readonly number[] = [1, 1 + HEX_DIGITS, 1 + HEX_DIGITS + HEX_DIGITS];

/** A grid button that shows whether it is the current choice. */
export function GridChoice({
  label,
  isPressed,
  isDisabled = false,
  onClick,
  children,
}: {
  label: string;
  isPressed: boolean;
  isDisabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}): ReactElement {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={isPressed}
      disabled={isDisabled}
      className={cn(
        'grid h-8 min-w-0 place-items-center rounded-control border border-border text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50',
        'aria-pressed:border-accent-ink aria-pressed:bg-accent-wash aria-pressed:text-accent-ink-strong',
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/** Every participant as an option: "Label (id)", or just the id. */
export function participantOptions(model: SequenceModel): SelectOption[] {
  return model.participants.map((participant) => ({
    value: participant.id,
    label:
      participant.label === participant.id
        ? participant.id
        : `${participant.label} (${participant.id})`,
  }));
}

export function ParticipantSelect({
  label,
  model,
  value,
  hasNone = false,
  onChange,
}: {
  label: string;
  model: SequenceModel;
  value: string;
  hasNone?: boolean;
  onChange: (id: string) => void;
}): ReactElement {
  const options: SelectOption[] = [
    ...(hasNone ? [{ value: '', label: 'None' }] : []),
    ...participantOptions(model),
  ];
  return (
    <SelectField
      label={label}
      value={value}
      groups={[{ label: 'Participants', options }]}
      onChange={onChange}
    />
  );
}

export function KindPicker({
  value,
  onChange,
}: {
  value: ParticipantKind;
  onChange: (kind: ParticipantKind) => void;
}): ReactElement {
  return (
    <InspectorSection label="Kind">
      <div className="grid grid-cols-4 gap-1">
        {KINDS.map((kind) => (
          <GridChoice
            key={kind}
            label={KIND_NAMES[kind]}
            isPressed={kind === value}
            onClick={() => {
              onChange(kind);
            }}
          >
            <KindIcon kind={kind} size={18} />
          </GridChoice>
        ))}
      </div>
    </InspectorSection>
  );
}

/** "Wrap in" one of the blocks; off when the rows are not neighbours in one list. */
export function WrapButtons({
  isDisabled = false,
  onWrap,
}: {
  isDisabled?: boolean;
  onWrap: (kind: BlockKind) => void;
}): ReactElement {
  return (
    <InspectorSection label="Wrap in">
      <div className="grid grid-cols-4 gap-1">
        {WRAP_KINDS.map((kind) => (
          <GridChoice
            key={kind}
            label={`Wrap in ${kind}`}
            isPressed={false}
            isDisabled={isDisabled}
            onClick={() => {
              onWrap(kind);
            }}
          >
            {BLOCKS[kind].name.toLowerCase()}
          </GridChoice>
        ))}
      </div>
    </InspectorSection>
  );
}

/** A CSS color as `#rrggbb`, read through the browser; null for none or what it cannot read. */
export function toHex(color: string): string | null {
  if (color === '' || color === 'transparent') {
    return null;
  }
  const probe: HTMLDivElement = document.createElement('div');
  probe.style.color = color;
  document.body.append(probe);
  const rgb: string = getComputedStyle(probe).color;
  probe.remove();
  const parts: string[] | undefined = /(\d+),\s*(\d+),\s*(\d+)/.exec(rgb)?.slice(1);
  return parts === undefined
    ? null
    : `#${parts.map((part) => Number(part).toString(HEX_RADIX).padStart(HEX_DIGITS, '0')).join('')}`;
}

/** `#rrggbb` as `rgb()`, keeping the alpha of an `rgba()` it replaces (Mermaid reads both). */
export function hexToRgb(hex: string, previous: string): string {
  const [red, green, blue] = CHANNEL_STARTS.map((start) =>
    Number.parseInt(hex.slice(start, start + HEX_DIGITS), HEX_RADIX),
  );
  const alpha: string | undefined = /rgba\([^)]*,\s*([\d.]+)\s*\)/.exec(previous)?.[1];
  const channels: string = `${String(red)}, ${String(green)}, ${String(blue)}`;
  return alpha === undefined ? `rgb(${channels})` : `rgba(${channels}, ${alpha})`;
}

/** A color as text plus the browser's picker (v1's `ColorField`). */
export function ColorField({
  label,
  value,
  placeholder,
  onCommit,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onCommit: (color: string) => void;
}): ReactElement {
  return (
    <div className="flex items-end gap-2">
      <input
        type="color"
        aria-label={`${label} picker`}
        value={toHex(value) ?? FALLBACK_COLOR}
        className="h-8 w-9 shrink-0 cursor-pointer rounded-control border bg-subtle p-0.5"
        onChange={(event) => {
          onCommit(hexToRgb(event.target.value, value));
        }}
      />
      <div className="min-w-0 flex-1">
        <CommitField
          label={label}
          value={value}
          {...(placeholder === undefined ? {} : { placeholder })}
          onCommit={(text) => {
            onCommit(text.trim());
          }}
        />
      </div>
    </div>
  );
}
