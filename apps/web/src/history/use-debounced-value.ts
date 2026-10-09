import { useEffect, useState } from 'react';

/** `value`, but only after it has stopped changing for `delayMs` (thumbnails of code being typed). */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState<T>(value);
  useEffect(() => {
    const timer: ReturnType<typeof setTimeout> = setTimeout(() => {
      setSettled(value);
    }, delayMs);
    return (): void => {
      clearTimeout(timer);
    };
  }, [value, delayMs]);
  return settled;
}
