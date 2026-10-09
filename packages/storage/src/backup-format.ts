import { z } from 'zod';

import {
  diagramFromV1,
  V1_BACKUP_FORMAT,
  V1_BACKUP_VERSION,
  v1BackupSchema,
  versionFromV1,
} from './backup-v1.ts';
import { InvalidBackupError } from './errors.ts';
import { diagramPositionsSchema, diagramSchema, versionSchema } from './records.ts';

import type { V1Backup } from './backup-v1.ts';
import type { Diagram, DiagramPositions, Version } from './records.ts';

type BackupFormat = 'nautink-backup';
type BackupVersion = 1;

export const BACKUP_FORMAT: BackupFormat = 'nautink-backup';
export const BACKUP_VERSION: BackupVersion = 1;

/** A full export of the workspace. `positions` maps a diagram id to its positions by namespace. */
export interface Backup {
  format: BackupFormat;
  version: BackupVersion;
  exportedAt: string;
  diagrams: Diagram[];
  versions: Version[];
  positions: Record<string, DiagramPositions>;
}

export const backupSchema: z.ZodType<Backup> = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.literal(BACKUP_VERSION),
  exportedAt: z.string(),
  diagrams: z.array(diagramSchema),
  versions: z.array(versionSchema),
  positions: z.record(z.string(), diagramPositionsSchema),
});

interface BackupHeader {
  format: string;
  version: number;
}

const headerSchema: z.ZodType<BackupHeader> = z.object({
  format: z.string(),
  version: z.number(),
});

const SUPPORTED_VERSIONS: Readonly<Record<string, number>> = {
  [BACKUP_FORMAT]: BACKUP_VERSION,
  [V1_BACKUP_FORMAT]: V1_BACKUP_VERSION,
};

function parseOrThrow<T>(schema: z.ZodType<T>, data: unknown): T {
  const result: z.ZodSafeParseResult<T> = schema.safeParse(data);
  if (!result.success) {
    throw new InvalidBackupError(`The backup is not valid:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

function readHeader(data: unknown): BackupHeader {
  const result: z.ZodSafeParseResult<BackupHeader> = headerSchema.safeParse(data);
  if (!result.success) {
    throw new InvalidBackupError('This file is not a backup: it has no "format" and "version".');
  }
  return result.data;
}

function checkSupported({ format, version }: BackupHeader): void {
  const supported: number | undefined = SUPPORTED_VERSIONS[format];
  if (supported === undefined) {
    throw new InvalidBackupError(
      `Unknown backup format "${format}". Expected "${BACKUP_FORMAT}" or "${V1_BACKUP_FORMAT}".`,
    );
  }
  if (version > supported) {
    throw new InvalidBackupError(
      `Backup format version ${String(version)} is newer than this app supports (${String(supported)}).`,
    );
  }
  if (version !== supported) {
    throw new InvalidBackupError(`Backup format version ${String(version)} is not supported.`);
  }
}

/** A v1 (Mermaid Chat) backup in the v2 shape: `mode` becomes `view`, `draft` starts empty. */
export function fromV1Backup(backup: V1Backup, now: number): Backup {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: backup.exportedAt,
    diagrams: backup.diagrams.map((diagram) => diagramFromV1(diagram, now)),
    versions: (backup.versions ?? []).map((version) => versionFromV1(version, now)),
    positions: backup.positions ?? {},
  };
}

/**
 * Checks a parsed backup file and returns it in the v2 shape. Accepts Nautink backups and v1
 * (Mermaid Chat) backups. Throws `InvalidBackupError` with a message for the user otherwise.
 */
export function validateBackup(data: unknown): Backup {
  const header: BackupHeader = readHeader(data);
  checkSupported(header);
  if (header.format === BACKUP_FORMAT) {
    return parseOrThrow(backupSchema, data);
  }
  return fromV1Backup(parseOrThrow(v1BackupSchema, data), Date.now());
}
