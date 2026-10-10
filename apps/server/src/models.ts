import { codexModelSchema } from '@nautink/contracts/models';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { z } from 'zod';

import type { Logger } from './logger.ts';
import type { ModelOption } from '@nautink/contracts/models';

const execFileAsync: (
  file: string,
  args: string[],
  options: { timeout: number; encoding: 'utf8' },
) => Promise<{ stdout: string; stderr: string }> = promisify(execFile);

interface CatalogEntry {
  slug: string;
  label: string;
  isListed: boolean;
}

// Only the fields Nautink reads from `codex debug models` (the catalog has many more), renamed to
// camelCase as they are parsed.
const catalogSchema: z.ZodType<{ models: CatalogEntry[] }> = z.object({
  models: z.array(
    z
      .object({ slug: z.string(), display_name: z.string(), visibility: z.string() })
      .transform((entry) => ({
        slug: entry.slug,
        label: entry.display_name,
        isListed: entry.visibility === 'list',
      })),
  ),
});

function parseJson(output: string): unknown {
  try {
    return JSON.parse(output);
  } catch {
    throw new Error('`codex debug models` did not print JSON');
  }
}

/** The models Codex shows in its own picker (`visibility: "list"`), in catalog order. */
export function parseCodexModels(output: string): ModelOption[] {
  const catalog: z.ZodSafeParseResult<{ models: CatalogEntry[] }> = catalogSchema.safeParse(
    parseJson(output),
  );
  if (!catalog.success) {
    throw new Error('`codex debug models` printed an unknown catalog shape');
  }
  return catalog.data.models
    .filter((entry: CatalogEntry) => entry.isListed)
    .filter((entry: CatalogEntry) => codexModelSchema.safeParse(entry.slug).success)
    .map((entry: CatalogEntry) => ({ id: entry.slug, label: entry.label }));
}

export interface CodexModelsOptions {
  codexBin: string;
  timeoutMs: number;
  logger: Logger;
}

/**
 * The installed Codex CLI's models (ADR-002). Never throws: when the catalog cannot be read the list
 * is empty, so the picker offers only "Default", and the reason is logged.
 */
export async function listCodexModels(options: CodexModelsOptions): Promise<ModelOption[]> {
  try {
    const { stdout } = await execFileAsync(options.codexBin, ['debug', 'models'], {
      timeout: options.timeoutMs,
      encoding: 'utf8',
    });
    return parseCodexModels(stdout);
  } catch (err) {
    const reason: string = err instanceof Error ? err.message : String(err);
    options.logger.error(`Cannot list the Codex models: ${reason}`);
    return [];
  }
}
