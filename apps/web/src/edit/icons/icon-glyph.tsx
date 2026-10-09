import { cn } from '@nautink/ui/lib/utils';
import { useEffect, useState } from 'react';

import { getIcon } from './icon-lookup.ts';

import type { IconData } from '@nautink/visual-core/icons';
import type { ReactElement } from 'react';

type GlyphState = { kind: 'loading' } | { kind: 'missing' } | { kind: 'ready'; icon: IconData };

interface IconGlyphProps {
  /** "pack:name", e.g. "logos:aws". */
  name: string;
  size?: number;
  className?: string;
}

/** The icon, or null when it cannot be drawn: no such icon, an unknown pack, a failed fetch. */
async function findGlyph(name: string): Promise<IconData | null> {
  try {
    return await getIcon(name);
  } catch {
    return null;
  }
}

function GlyphLoader({ name, size = 24, className }: IconGlyphProps): ReactElement {
  const [state, setState] = useState<GlyphState>({ kind: 'loading' });
  useEffect(() => {
    let isLive: boolean = true;
    const load = async (): Promise<void> => {
      const icon: IconData | null = await findGlyph(name);
      if (isLive) {
        setState(icon === null ? { kind: 'missing' } : { kind: 'ready', icon });
      }
    };
    void load();
    return (): void => {
      isLive = false;
    };
  }, [name]);
  const box: { width: number; height: number } = { width: size, height: size };
  if (state.kind !== 'ready') {
    return (
      <span
        aria-hidden="true"
        className={cn('grid place-items-center text-xs text-faint', className)}
        style={box}
      >
        {state.kind === 'missing' ? '?' : null}
      </span>
    );
  }
  return (
    <svg
      aria-hidden="true"
      className={className}
      {...box}
      viewBox={`0 0 ${String(state.icon.width)} ${String(state.icon.height)}`}
      // Sanitized with DOMPurify in getIcon.
      dangerouslySetInnerHTML={{ __html: state.icon.body }}
    />
  );
}

/** An Iconify icon drawn inline, its pack fetched on demand. "?" when the pack has no such icon. */
export function IconGlyph(props: IconGlyphProps): ReactElement {
  return <GlyphLoader key={props.name} {...props} />;
}
