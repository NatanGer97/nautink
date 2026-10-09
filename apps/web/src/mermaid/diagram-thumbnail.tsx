import { cn } from '@nautink/ui/lib/utils';
import { DARK_QUERY, resolveTheme } from '@nautink/ui/theme';
import { useEffect, useRef, useState } from 'react';

import { renderThumbnail } from './render-thumbnail.ts';
import { useMediaQuery } from '../lib/use-media-query.ts';
import { useUiStore } from '../state/ui-store.ts';

import type { Thumbnail } from './render-thumbnail.ts';
import type { ThemePreference } from '@nautink/ui/theme';
import type { ReactElement, RefObject } from 'react';

export interface DiagramThumbnailProps {
  code: string;
  className?: string;
  /** Render at once instead of waiting until it scrolls into view. */
  isEager?: boolean;
}

/** Starts rendering once the element is near the viewport (or at once without IntersectionObserver). */
function useIsNearView(ref: RefObject<HTMLElement | null>, isEager: boolean): boolean {
  const [isNear, setNear] = useState<boolean>(isEager || !('IntersectionObserver' in window));
  useEffect(() => {
    const element: HTMLElement | null = ref.current;
    if (isNear || element === null) {
      return undefined;
    }
    const observer: IntersectionObserver = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNear(true);
        }
      },
      { rootMargin: '80px' },
    );
    observer.observe(element);
    return (): void => {
      observer.disconnect();
    };
  }, [ref, isNear]);
  return isNear;
}

function useThumbnail(code: string, isNear: boolean): Thumbnail | null {
  const preference: ThemePreference = useUiStore((state) => state.themePreference);
  const isDark: boolean = resolveTheme(preference, useMediaQuery(DARK_QUERY)) === 'dark';
  const [result, setResult] = useState<{ key: string; thumbnail: Thumbnail } | null>(null);
  const key: string = `${String(isDark)}\n${code}`;
  useEffect(() => {
    if (!isNear) {
      return undefined;
    }
    const run: { isLive: boolean } = { isLive: true };
    void (async (): Promise<void> => {
      const thumbnail: Thumbnail = await renderThumbnail(code, isDark);
      if (run.isLive) {
        setResult({ key, thumbnail });
      }
    })();
    return (): void => {
      run.isLive = false;
    };
  }, [code, isDark, isNear, key]);
  return result?.key === key ? result.thumbnail : null;
}

/** A small rendered picture of a diagram, drawn lazily through the Mermaid queue. */
export function DiagramThumbnail({
  code,
  className,
  isEager = false,
}: DiagramThumbnailProps): ReactElement {
  const ref: RefObject<HTMLSpanElement | null> = useRef<HTMLSpanElement>(null);
  const thumbnail: Thumbnail | null = useThumbnail(code, useIsNearView(ref, isEager));
  return (
    <span
      ref={ref}
      data-state={thumbnail?.kind ?? 'pending'}
      className={cn(
        'grid shrink-0 place-items-center overflow-hidden rounded-control border bg-background text-2xs text-faint',
        className,
      )}
    >
      {thumbnail?.kind === 'image' ? (
        <img
          src={thumbnail.url}
          alt=""
          draggable={false}
          className="size-full object-contain p-1"
        />
      ) : (
        <span aria-hidden="true">{thumbnail?.message ?? ''}</span>
      )}
    </span>
  );
}
