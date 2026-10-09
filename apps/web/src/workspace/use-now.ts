import { useEffect, useState } from 'react';

/** Relative times refresh this often, so "just now" does not stay on screen for an hour. */
const NOW_INTERVAL_MS: number = 30_000;

/** The current time, refreshed every 30 s while the component is mounted. */
export function useNow(intervalMs: number = NOW_INTERVAL_MS): number {
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const timer: ReturnType<typeof setInterval> = setInterval(() => {
      setNow(Date.now());
    }, intervalMs);
    return (): void => {
      clearInterval(timer);
    };
  }, [intervalMs]);
  return now;
}
