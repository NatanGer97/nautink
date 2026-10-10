import { realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

import { expandHome, isStrictlyInside } from './repo-dir.ts';

/** The server's settings, read once from the environment at startup. */
export interface ServerConfig {
  port: number;
  claudeBin: string;
  codexBin: string;
  /** The codebase Claude may read at startup (`REPO_DIR`); `null` means repo-aware mode is off. */
  repoDir: string | null;
  isProduction: boolean;
}

export const DEFAULT_PORT: number = 8791;
export const DEFAULT_CLAUDE_BIN: string = 'claude';
export const DEFAULT_CODEX_BIN: string = 'codex';
const MAX_PORT: number = 65_535;

function toExistingDirectory(input: string, context: z.RefinementCtx<string>): string {
  try {
    const resolved: string = realpathSync(path.resolve(input));
    if (statSync(resolved).isDirectory()) {
      return resolved;
    }
  } catch {
    context.addIssue({ code: 'custom', message: `REPO_DIR does not exist: ${input}` });
    return z.NEVER;
  }
  context.addIssue({ code: 'custom', message: `REPO_DIR is not a folder: ${input}` });
  return z.NEVER;
}

/**
 * The same rule as a folder chosen in the app (`resolveRepoDir`): strictly inside the home folder,
 * symlinks followed. The home folder itself holds keys and tokens Claude must not read.
 */
function toHomeFolder(
  homeDir: string,
): (input: string, context: z.RefinementCtx<string>) => string {
  return (input: string, context: z.RefinementCtx<string>): string => {
    const realHome: string = realpathSync(homeDir);
    if (isStrictlyInside(input, realHome)) {
      return input;
    }
    context.addIssue({
      code: 'custom',
      message: `REPO_DIR must be inside your home folder (${realHome}): ${input}`,
    });
    return z.NEVER;
  };
}

const portSchema: z.ZodType<number, string | undefined> = z
  .string()
  .regex(/^\d+$/, 'API_PORT must be a whole number')
  .transform(Number)
  .pipe(z.number().max(MAX_PORT, `API_PORT must be at most ${String(MAX_PORT)}`))
  .default(DEFAULT_PORT);

function createRepoDirSchema(homeDir: string): z.ZodType<string | undefined, string | undefined> {
  return z
    .string()
    .min(1, 'REPO_DIR must not be empty')
    .transform((input: string, context: z.RefinementCtx<string>) =>
      toExistingDirectory(expandHome(input, homeDir), context),
    )
    .transform(toHomeFolder(homeDir))
    .optional();
}

function createEnvSchema(homeDir: string): z.ZodType<ServerConfig, Record<string, unknown>> {
  return z
    .object({
      API_PORT: portSchema,
      CLAUDE_BIN: z.string().min(1, 'CLAUDE_BIN must not be empty').default(DEFAULT_CLAUDE_BIN),
      CODEX_BIN: z.string().min(1, 'CODEX_BIN must not be empty').default(DEFAULT_CODEX_BIN),
      REPO_DIR: createRepoDirSchema(homeDir),
      NODE_ENV: z.string().optional(),
    })
    .transform((env) => ({
      port: env.API_PORT,
      claudeBin: env.CLAUDE_BIN,
      codexBin: env.CODEX_BIN,
      repoDir: env.REPO_DIR ?? null,
      isProduction: env.NODE_ENV === 'production',
    }));
}

/** Reads and validates the environment. Throws one error that lists every invalid variable. */
export function loadConfig(env: NodeJS.ProcessEnv, homeDir: string): ServerConfig {
  const result: z.ZodSafeParseResult<ServerConfig> = createEnvSchema(homeDir).safeParse(env);
  if (!result.success) {
    const problems: string[] = result.error.issues.map((issue: z.core.$ZodIssue) => issue.message);
    throw new Error(`Invalid server configuration:\n  - ${problems.join('\n  - ')}`);
  }
  return result.data;
}
