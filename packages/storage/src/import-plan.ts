import { createId } from './db.ts';
import { toPositionRecords } from './positions.ts';

import type { Backup } from './backup-format.ts';
import type { PositionRecord } from './db.ts';
import type { Diagram, Version } from './records.ts';

/** Ids already in the database; an imported record that clashes with one gets a new id. */
export interface TakenIds {
  diagrams: ReadonlySet<string>;
  versions: ReadonlySet<string>;
}

/** The records an import will write. Versions whose diagram is not in the backup are skipped. */
export interface ImportPlan {
  diagrams: Diagram[];
  versions: Version[];
  positions: PositionRecord[];
  skippedVersions: number;
}

interface RemappedDiagrams {
  diagrams: Diagram[];
  idMap: Map<string, string>;
}

function remapDiagrams(diagrams: readonly Diagram[], taken: ReadonlySet<string>): RemappedDiagrams {
  const used: Set<string> = new Set<string>(taken);
  const idMap: Map<string, string> = new Map<string, string>();
  const remapped: Diagram[] = diagrams.map((diagram) => {
    const isClash: boolean = used.has(diagram.id) || idMap.has(diagram.id);
    const id: string = isClash ? createId() : diagram.id;
    idMap.set(diagram.id, id);
    used.add(id);
    return { ...diagram, id };
  });
  return { diagrams: remapped, idMap };
}

function remapVersions(
  versions: readonly Version[],
  idMap: ReadonlyMap<string, string>,
  taken: ReadonlySet<string>,
): Version[] {
  const used: Set<string> = new Set<string>(taken);
  return versions.flatMap((version) => {
    const diagramId: string | undefined = idMap.get(version.diagramId);
    if (diagramId === undefined) {
      return [];
    }
    const id: string = used.has(version.id) ? createId() : version.id;
    used.add(id);
    return [{ ...version, id, diagramId }];
  });
}

function remapPositions(backup: Backup, idMap: ReadonlyMap<string, string>): PositionRecord[] {
  return Object.entries(backup.positions).flatMap(([oldId, positions]) => {
    const diagramId: string | undefined = idMap.get(oldId);
    return diagramId === undefined ? [] : toPositionRecords(diagramId, positions);
  });
}

/**
 * How a backup merges into the database, as v1 does it: existing records are kept, an imported
 * diagram or version whose id is taken gets a new id, and versions and positions follow their
 * diagram's new id.
 */
export function planImport(backup: Backup, taken: TakenIds): ImportPlan {
  const { diagrams, idMap } = remapDiagrams(backup.diagrams, taken.diagrams);
  const versions: Version[] = remapVersions(backup.versions, idMap, taken.versions);
  return {
    diagrams,
    versions,
    positions: remapPositions(backup, idMap),
    skippedVersions: backup.versions.length - versions.length,
  };
}
