/**
 * Builds the published `nautink` package into `dist/`: `cli.js`, one ESM bundle of the command, the
 * server and the workspace packages (Node will not strip types inside `node_modules`), and `web/`,
 * a copy of the built web app. npm dependencies stay external and are installed with the package.
 */
import { build } from 'esbuild';
import { cpSync, existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

export interface BuildOptions {
  webDistDir: string;
  outDir: string;
}

const PACKAGE_DIR: string = path.join(import.meta.dirname, '..');

/** The npm packages the bundle imports at runtime; each must be in this package's `dependencies`. */
export const RUNTIME_DEPENDENCIES: readonly string[] = ['express', 'zod'];

export async function buildCli(options: BuildOptions): Promise<void> {
  if (!existsSync(path.join(options.webDistDir, 'index.html'))) {
    throw new Error(
      `The web app is not built: ${options.webDistDir} has no index.html. Run pnpm --filter @nautink/web build first.`,
    );
  }
  rmSync(options.outDir, { recursive: true, force: true });
  await build({
    entryPoints: [path.join(PACKAGE_DIR, 'src', 'cli.ts')],
    outfile: path.join(options.outDir, 'cli.js'),
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node22',
    external: [...RUNTIME_DEPENDENCIES],
    logLevel: 'warning',
  });
  cpSync(options.webDistDir, path.join(options.outDir, 'web'), { recursive: true });
}

if (import.meta.main) {
  await buildCli({
    webDistDir: path.join(PACKAGE_DIR, '..', 'web', 'dist'),
    outDir: path.join(PACKAGE_DIR, 'dist'),
  });
  process.stdout.write('Built apps/cli/dist\n');
}
