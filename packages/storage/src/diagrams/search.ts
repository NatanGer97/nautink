import { sortDiagrams } from './diagram-order.ts';

import type { Diagram } from '../db/records.ts';

/** The first code line that contains the query, trimmed, with the match's place in it. */
export interface LineMatch {
  line: string;
  start: number;
  end: number;
}

/** A diagram that passed the search, and where the query was found. */
export type SearchHit =
  | { diagram: Diagram; matchedIn: 'none' }
  | { diagram: Diagram; matchedIn: 'title' }
  | { diagram: Diagram; matchedIn: 'content'; match: LineMatch };

/** The first line of `code` containing `query` (case-insensitive), or undefined when none does. */
export function findLine(code: string, query: string): LineMatch | undefined {
  const needle: string = query.toLowerCase();
  for (const raw of code.split('\n')) {
    const index: number = raw.toLowerCase().indexOf(needle);
    if (index >= 0) {
      const lead: number = raw.length - raw.trimStart().length;
      return { line: raw.trim(), start: index - lead, end: index - lead + needle.length };
    }
  }
  return undefined;
}

function matchDiagram(diagram: Diagram, query: string): SearchHit | undefined {
  if (diagram.title.toLowerCase().includes(query)) {
    return { diagram, matchedIn: 'title' };
  }
  const match: LineMatch | undefined = findLine(diagram.code, query);
  return match === undefined ? undefined : { diagram, matchedIn: 'content', match };
}

/**
 * Diagrams whose title or code contains the query, in list order (pinned, then recent). A title
 * match wins over a content match. A blank query keeps every diagram, with `matchedIn: 'none'`.
 */
export function searchDiagrams(diagrams: readonly Diagram[], query: string): SearchHit[] {
  const needle: string = query.trim().toLowerCase();
  const sorted: Diagram[] = sortDiagrams(diagrams);
  if (needle === '') {
    return sorted.map((diagram) => ({ diagram, matchedIn: 'none' }));
  }
  return sorted.map((diagram) => matchDiagram(diagram, needle)).filter((hit) => hit !== undefined);
}
