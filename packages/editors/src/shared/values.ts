/** v1's `value || fallback` for numbers: zero, NaN, null and undefined all take the fallback. */
export function numberOr(value: number | null | undefined, fallback: number): number {
  const isSet: boolean = typeof value === 'number' && value !== 0 && !Number.isNaN(value);
  return isSet && typeof value === 'number' ? value : fallback;
}

/** v1's `value || null` for numbers: zero and NaN become null too. */
export function numberOrNull(value: number | null | undefined): number | null {
  const number: number = numberOr(value, 0);
  return number === 0 ? null : number;
}

/** The text at `index` of a list (regex match groups, lines), or '' past its end. */
export function textAt(list: ArrayLike<string | undefined>, index: number): string {
  return list[index] ?? '';
}

/** v1's `text || fallback` for strings: an empty or missing text takes the fallback. */
export function textOr(text: string | undefined, fallback: string): string {
  return text === undefined || text === '' ? fallback : text;
}

/** The number at `index` of a list, or 0 past its end. */
export function numberAt(list: ArrayLike<number | undefined>, index: number): number {
  return list[index] ?? 0;
}
