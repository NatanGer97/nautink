import { agentIdSchema } from '@nautink/contracts/agents';
import { z } from 'zod';

import type { AgentId } from '@nautink/contracts/agents';

// Record shapes (PRD §7.3) and the Zod schemas that check them in backups. Field names are v1's
// (`pinned`, `titleAuto`, `auto`, `streaming`) so v1 backups import unchanged (PRD §8).

/** What the canvas shows for a diagram. Replaces v1's `mode` ('code' → 'preview', 'visual' → 'edit'). */
export type DiagramView = 'preview' | 'edit' | 'split';

/** Timing and cost of one Claude reply, as the server's `done` event reports them. */
export interface ChatMessageMeta {
  durationMs?: number | null | undefined;
  costUsd?: number | null | undefined;
}

/** What the user did with a reply's proposed change (new in v2, PRD §4.2). */
export interface ChatMessageReview {
  outcome: 'accepted' | 'rejected';
  /** How many changes the proposal had. */
  changes: number;
}

/** One chat bubble, stored exactly as v1 stores it, plus v2's optional `review`. */
export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  /** A user message the app sent itself (auto-fix, compaction), not one the user typed. */
  auto?: boolean | undefined;
  tools?: string[] | undefined;
  streaming?: boolean | undefined;
  error?: string | undefined;
  meta?: ChatMessageMeta | undefined;
  /** Set once the user accepted or rejected the change this reply proposed. */
  review?: ChatMessageReview | undefined;
  /** Which agent wrote this reply (ADR-002). Missing means Claude: replies from before Codex. */
  agent?: AgentId | undefined;
}

/** One diagram of the workspace. */
export interface Diagram {
  id: string;
  title: string;
  /** True while the title follows the code and chat; a rename sets it to false. */
  titleAuto: boolean;
  code: string;
  view: DiagramView;
  messages: ChatMessage[];
  sessionId: string | null;
  /** The agent that owns `sessionId` (ADR-002). Missing means Claude. */
  sessionAgent?: AgentId | undefined;
  pinned: boolean;
  /** Unsent chat text, kept per diagram (new in v2). */
  draft: string;
  createdAt: number;
  updatedAt: number;
}

export type VersionKind = 'claude' | 'manual' | 'restore';

/** A snapshot in a diagram's history. A non-empty `label` makes it a named version. */
export interface Version {
  id: string;
  diagramId: string;
  code: string;
  createdAt: number;
  kind: VersionKind;
  label: string;
  prompt: string;
  /** For a `claude` (agent) version: which agent wrote it (ADR-002). Missing means Claude. */
  agent?: AgentId | undefined;
}

/** Where one canvas item sits. Editors may store more than `x` and `y`, so extra keys are kept. */
export interface NodePosition {
  x: number;
  y: number;
  [key: string]: unknown;
}

/** Item id → position, for one editor of one diagram. */
export type PositionMap = Record<string, NodePosition>;

/** Editor namespace (`flow`, `class`, …) → that editor's positions, for one diagram. */
export type DiagramPositions = Record<string, PositionMap>;

export const diagramViewSchema: z.ZodType<DiagramView> = z.enum(['preview', 'edit', 'split']);

export const versionKindSchema: z.ZodType<VersionKind> = z.enum(['claude', 'manual', 'restore']);

const chatMessageMetaSchema: z.ZodType<ChatMessageMeta> = z.looseObject({
  durationMs: z.number().nullish(),
  costUsd: z.number().nullish(),
});

const chatMessageReviewSchema: z.ZodType<ChatMessageReview> = z.object({
  outcome: z.enum(['accepted', 'rejected']),
  changes: z.number().int().nonnegative(),
});

export const chatMessageSchema: z.ZodType<ChatMessage> = z.object({
  role: z.enum(['user', 'assistant']),
  text: z.string(),
  auto: z.boolean().optional(),
  tools: z.array(z.string()).optional(),
  streaming: z.boolean().optional(),
  error: z.string().optional(),
  meta: chatMessageMetaSchema.optional(),
  review: chatMessageReviewSchema.optional(),
  agent: agentIdSchema.optional(),
});

export const diagramSchema: z.ZodType<Diagram> = z.object({
  id: z.string().min(1),
  title: z.string(),
  titleAuto: z.boolean(),
  code: z.string(),
  view: diagramViewSchema,
  messages: z.array(chatMessageSchema),
  sessionId: z.string().nullable(),
  sessionAgent: agentIdSchema.optional(),
  pinned: z.boolean(),
  draft: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const versionSchema: z.ZodType<Version> = z.object({
  id: z.string().min(1),
  diagramId: z.string().min(1),
  code: z.string(),
  createdAt: z.number(),
  kind: versionKindSchema,
  label: z.string(),
  prompt: z.string(),
  agent: agentIdSchema.optional(),
});

const nodePositionSchema: z.ZodType<NodePosition> = z.looseObject({
  x: z.number(),
  y: z.number(),
});

export const positionMapSchema: z.ZodType<PositionMap> = z.record(z.string(), nodePositionSchema);

export const diagramPositionsSchema: z.ZodType<DiagramPositions> = z.record(
  z.string(),
  positionMapSchema,
);
