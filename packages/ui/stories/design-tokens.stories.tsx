import { cn } from '@nautink/ui/lib/utils';

import type { ResolvedTheme } from '../src/theme.ts';
import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactElement, ReactNode } from 'react';

// The PRD §6 tokens as globals.css defines them, light and dark side by side. The light column
// takes `:root`'s values and the dark column sets the `dark` class, so the toolbar theme is locked
// to light here.

/** §6.1 color tokens, by their CSS variable name. */
const COLORS: readonly string[] = [
  'background',
  'panel',
  'muted',
  'subtle',
  'border',
  'border-subtle',
  'border-strong',
  'foreground',
  'muted-foreground',
  'faint',
  'accent-ink',
  'accent-ink-strong',
  'accent-wash',
  'selection-ring',
  'success',
  'success-bg',
  'destructive',
  'destructive-bg',
  'warning',
  'warning-bg',
  'node-fill',
  'node-stroke',
  'edge',
  'grid-dot',
];

/** §6.2 type scale: the Tailwind class, its size and line height, and what it is for. */
const TYPE_SCALE: readonly { className: string; size: string; use: string }[] = [
  { className: 'text-2xs', size: '11 / 16', use: 'Badges and kbd only' },
  { className: 'text-xs', size: '12 / 16', use: 'Meta and helper text' },
  { className: 'text-sm', size: '13 / 20', use: 'Base UI' },
  { className: 'text-base', size: '14 / 20', use: 'Panel titles and the app name' },
  { className: 'text-lg', size: '16 / 24', use: 'Dialog titles' },
  { className: 'text-display', size: '28 / 36', use: 'The first-run heading' },
  { className: 'font-mono text-code', size: '12.5 / 20', use: 'Code' },
];

/** §6.3 spacing: the 4 px grid's gaps, as Tailwind width classes. */
const SPACING: readonly { className: string; px: string }[] = [
  { className: 'w-1', px: '4' },
  { className: 'w-1.5', px: '6' },
  { className: 'w-2', px: '8' },
  { className: 'w-2.5', px: '10' },
  { className: 'w-3', px: '12' },
  { className: 'w-4', px: '16' },
];

/** §6.3 radius, smallest to largest. */
const RADII: readonly { className: string; label: string }[] = [
  { className: 'rounded-control', label: 'control · 6' },
  { className: 'rounded-track', label: 'track · 8' },
  { className: 'rounded-card', label: 'card · 10' },
  { className: 'rounded-float', label: 'float · 12' },
  { className: 'rounded-dialog', label: 'dialog · 14' },
];

/** §6.3 elevation: only floating things get a shadow. */
const ELEVATIONS: readonly { className: string; label: string }[] = [
  { className: 'shadow-float', label: 'Floating toolbar' },
  { className: 'shadow-menu', label: 'Menu, popover' },
  { className: 'shadow-dialog', label: 'Dialog' },
];

function Section({ title, children }: { title: string; children: ReactNode }): ReactElement {
  return (
    <section aria-label={title} className="grid gap-2">
      <h3 className="text-xs font-medium text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

function Swatch({ name }: { name: string }): ReactElement {
  return (
    <li className="flex items-center gap-2">
      <span
        aria-hidden="true"
        className="size-6 shrink-0 rounded-control border border-border-strong"
        style={{ background: `var(--${name})` }}
      />
      <code className="font-mono text-xs">--{name}</code>
    </li>
  );
}

function ThemeColumn({
  theme,
  children,
}: {
  theme: ResolvedTheme;
  children: ReactNode;
}): ReactElement {
  return (
    <div
      className={cn(
        'grid content-start gap-5 rounded-card border bg-background p-5 text-foreground',
        theme === 'dark' && 'dark',
      )}
    >
      <h2 className="text-base font-semibold">{theme === 'dark' ? 'Dark' : 'Light'}</h2>
      {children}
    </div>
  );
}

function SideBySide({ render }: { render: () => ReactNode }): ReactElement {
  return (
    <div className="grid gap-4 p-4 md:grid-cols-2">
      <ThemeColumn theme="light">{render()}</ThemeColumn>
      <ThemeColumn theme="dark">{render()}</ThemeColumn>
    </div>
  );
}

function Colors(): ReactElement {
  return (
    <Section title="Color (§6.1)">
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {COLORS.map((name) => (
          <Swatch key={name} name={name} />
        ))}
      </ul>
    </Section>
  );
}

function TypeScale(): ReactElement {
  return (
    <Section title="Type scale (§6.2)">
      <ul className="grid gap-2">
        {TYPE_SCALE.map((step) => (
          <li key={step.className} className="flex items-baseline gap-3">
            <span className={step.className}>Diagram</span>
            <span className="text-xs text-muted-foreground">
              {step.size} · {step.use}
            </span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Spacing(): ReactElement {
  return (
    <Section title="Spacing (§6.3, 4 px grid)">
      <ul className="grid gap-1.5">
        {SPACING.map((step) => (
          <li key={step.className} className="flex items-center gap-3">
            <span aria-hidden="true" className={cn('h-3 bg-accent-ink', step.className)} />
            <span className="text-xs text-muted-foreground">{step.px} px</span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Shapes(): ReactElement {
  return (
    <>
      <Section title="Radius (§6.3)">
        <ul className="flex flex-wrap gap-3">
          {RADII.map((radius) => (
            <li
              key={radius.className}
              className={cn(
                'grid size-20 place-items-center border bg-panel text-2xs',
                radius.className,
              )}
            >
              {radius.label}
            </li>
          ))}
        </ul>
      </Section>
      <Section title="Elevation (§6.3)">
        <ul className="flex flex-wrap gap-4">
          {ELEVATIONS.map((elevation) => (
            <li
              key={elevation.className}
              className={cn('rounded-float border bg-panel px-3 py-4 text-xs', elevation.className)}
            >
              {elevation.label}
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}

const meta: Meta = {
  title: 'Foundations/Design tokens',
  globals: { theme: 'light' },
  parameters: { layout: 'fullscreen' },
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Color: Story = { render: () => <SideBySide render={() => <Colors />} /> };

export const Typography: Story = { render: () => <SideBySide render={() => <TypeScale />} /> };

export const SpacingScale: Story = { render: () => <SideBySide render={() => <Spacing />} /> };

export const RadiusAndElevation: Story = {
  render: () => <SideBySide render={() => <Shapes />} />,
};
