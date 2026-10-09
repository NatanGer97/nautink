/** Anything that groups members by id: flowchart and ER subgraphs. */
export interface MemberGroup {
  id: string;
  members: readonly string[];
}

/** Innermost group of each member id. Mermaid lists inner subgraphs first, so the first wins. */
export function parentMap(groups: readonly MemberGroup[]): Map<string, string> {
  const parent: Map<string, string> = new Map<string, string>();
  for (const group of groups) {
    for (const member of group.members) {
      if (!parent.has(member) && member !== group.id) {
        parent.set(member, group.id);
      }
    }
  }
  return parent;
}
