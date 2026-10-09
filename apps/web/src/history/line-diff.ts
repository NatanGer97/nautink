/** One line of a diff: in both, only in the new code, or only in the old code. */
export interface DiffLine {
  kind: 'same' | 'added' | 'removed';
  text: string;
}

/** How many lines were added and removed. */
export interface DiffStats {
  added: number;
  removed: number;
}

function splitLines(code: string): string[] {
  return code === '' ? [] : code.replace(/\n$/, '').split('\n');
}

/** Longest common subsequence lengths of every pair of suffixes, in a flat table. */
class CommonTable {
  private readonly width: number;
  private readonly cells: Int32Array;

  constructor(before: readonly string[], after: readonly string[]) {
    this.width = after.length + 1;
    this.cells = new Int32Array((before.length + 1) * this.width);
    for (let i: number = before.length - 1; i >= 0; i -= 1) {
      for (let j: number = after.length - 1; j >= 0; j -= 1) {
        this.cells[i * this.width + j] =
          before[i] === after[j]
            ? this.at(i + 1, j + 1) + 1
            : Math.max(this.at(i + 1, j), this.at(i, j + 1));
      }
    }
  }

  /** The common length of `before[i..]` and `after[j..]`. */
  at(i: number, j: number): number {
    return this.cells[i * this.width + j] ?? 0;
  }
}

interface DiffWalk {
  old: readonly string[];
  next: readonly string[];
  table: CommonTable;
}

/** The kind of the next line when the walk stands at `old[i]` and `next[j]`. */
function stepKind({ old, next, table }: DiffWalk, i: number, j: number): DiffLine['kind'] {
  if (i < old.length && j < next.length && old[i] === next[j]) {
    return 'same';
  }
  const canRemove: boolean = i < old.length;
  const isRemovalBetter: boolean = j >= next.length || table.at(i + 1, j) >= table.at(i, j + 1);
  return canRemove && isRemovalBetter ? 'removed' : 'added';
}

/** A line diff from `before` to `after`, removals before additions where lines changed. */
export function diffLines(before: string, after: string): DiffLine[] {
  const old: string[] = splitLines(before);
  const next: string[] = splitLines(after);
  const walk: DiffWalk = { old, next, table: new CommonTable(old, next) };
  const lines: DiffLine[] = [];
  let i: number = 0;
  let j: number = 0;
  while (i < old.length || j < next.length) {
    const kind: DiffLine['kind'] = stepKind(walk, i, j);
    lines.push({ kind, text: (kind === 'added' ? next[j] : old[i]) ?? '' });
    i += kind === 'added' ? 0 : 1;
    j += kind === 'removed' ? 0 : 1;
  }
  return lines;
}

/** Counts the added and removed lines of a diff. */
export function diffStats(lines: readonly DiffLine[]): DiffStats {
  return {
    added: lines.filter((line) => line.kind === 'added').length,
    removed: lines.filter((line) => line.kind === 'removed').length,
  };
}
