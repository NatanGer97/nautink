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
