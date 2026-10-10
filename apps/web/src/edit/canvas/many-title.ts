/** How many of one kind are selected, and the kind's plural ("nodes"). */
export interface SelectedCount {
  count: number;
  plural: string;
}

/** The inspector title for several selected items: "2 nodes", "2 links", or "3 items" for a mix. */
export function manyTitle(counts: readonly SelectedCount[]): string {
  const present: SelectedCount[] = counts.filter((item) => item.count > 0);
  const total: number = present.reduce((sum, item) => sum + item.count, 0);
  const [only] = present;
  return present.length === 1 && only !== undefined
    ? `${String(total)} ${only.plural}`
    : `${String(total)} items`;
}
