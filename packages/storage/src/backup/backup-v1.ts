import { z } from 'zod';

import { chatMessageSchema, diagramPositionsSchema, versionKindSchema } from '../db/records.ts';

import type { Diagram, DiagramPositions, DiagramView, Version } from '../db/records.ts';

// Mermaid Chat (v1) backups, as v1's `exportAll` writes them and its `validateBackup` accepts them:
// only `id` and `code` are required, and every missing field gets the default v1's `importAll` gives
// it. A field that is present must have the right type.

type V1BackupFormat = 'mermaid-chat-backup';
type V1BackupVersion = 1;

export const V1_BACKUP_FORMAT: V1BackupFormat = 'mermaid-chat-backup';
export const V1_BACKUP_VERSION: V1BackupVersion = 1;

/** Every key of `T` optional, and allowed to be `undefined`. */
type Loose<T> = { [K in keyof T]?: T[K] | undefined };

type V1Mode = 'code' | 'visual';

type V1Diagram = Pick<Diagram, 'id' | 'code'> &
  Loose<
    Pick<
      Diagram,
      'title' | 'titleAuto' | 'messages' | 'sessionId' | 'pinned' | 'createdAt' | 'updatedAt'
    >
  > &
  Loose<{ mode: V1Mode }>;

type V1Version = Pick<Version, 'id' | 'diagramId' | 'code'> &
  Loose<Pick<Version, 'createdAt' | 'kind' | 'label' | 'prompt'>>;

export interface V1Backup {
  format: V1BackupFormat;
  version: V1BackupVersion;
  exportedAt: string;
  diagrams: V1Diagram[];
  versions?: V1Version[] | null | undefined;
  positions?: Record<string, DiagramPositions> | undefined;
}

const v1DiagramSchema: z.ZodType<V1Diagram> = z.object({
  id: z.string().min(1),
  code: z.string(),
  title: z.string().optional(),
  titleAuto: z.boolean().optional(),
  mode: z.enum(['code', 'visual']).optional(),
  messages: z.array(chatMessageSchema).optional(),
  sessionId: z.string().nullable().optional(),
  pinned: z.boolean().optional(),
  createdAt: z.number().optional(),
  updatedAt: z.number().optional(),
});

const v1VersionSchema: z.ZodType<V1Version> = z.object({
  id: z.string().min(1),
  diagramId: z.string().min(1),
  code: z.string(),
  createdAt: z.number().optional(),
  kind: versionKindSchema.optional(),
  label: z.string().optional(),
  prompt: z.string().optional(),
});

export const v1BackupSchema: z.ZodType<V1Backup> = z.object({
  format: z.literal(V1_BACKUP_FORMAT),
  version: z.literal(V1_BACKUP_VERSION),
  exportedAt: z.string(),
  diagrams: z.array(v1DiagramSchema),
  versions: z.array(v1VersionSchema).nullish(),
  positions: z.record(z.string(), diagramPositionsSchema).optional(),
});

/** v1's `mode` → v2's `view`: the visual editor is Edit, the code view is Preview. */
export function viewFromMode(mode: V1Mode | undefined): DiagramView {
  return mode === 'visual' ? 'edit' : 'preview';
}

/** A v1 diagram as a v2 record. Missing timestamps become `now`, as in v1's importer. */
export function diagramFromV1(diagram: V1Diagram, now: number): Diagram {
  const title: string = diagram.title ?? '';
  return {
    id: diagram.id,
    title,
    titleAuto: diagram.titleAuto ?? title === '',
    code: diagram.code,
    view: viewFromMode(diagram.mode),
    messages: diagram.messages ?? [],
    sessionId: diagram.sessionId ?? null,
    pinned: diagram.pinned ?? false,
    draft: '',
    createdAt: diagram.createdAt ?? now,
    updatedAt: diagram.updatedAt ?? now,
  };
}

/** A v1 version as a v2 record. A missing kind is 'manual', as in v1's importer. */
export function versionFromV1(version: V1Version, now: number): Version {
  return {
    id: version.id,
    diagramId: version.diagramId,
    code: version.code,
    createdAt: version.createdAt ?? now,
    kind: version.kind ?? 'manual',
    label: version.label ?? '',
    prompt: version.prompt ?? '',
  };
}
