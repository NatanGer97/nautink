#!/usr/bin/env node
/**
 * Fails when the web app's built JavaScript outgrows its budget (PRD §9: initial JavaScript stays
 * small; Monaco, the editors and the icon packs load lazily). Reads `apps/web/dist` after
 * `vite build`: the entry script and what `index.html` preloads with it are the initial load, and
 * every other chunk is lazy. Sizes are gzip, at Node's default level. The budgets and how to change
 * them are in docs/conventions.md.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { gzipSync } from 'node:zlib';

export interface LazyBudget {
  /** Shown in the report, e.g. `monaco-setup`. */
  label: string;
  /** Matches the chunk's file name without its content hash, e.g. `monaco-setup` or `elk-IJKZ…`. */
  pattern: RegExp;
  maxGzipBytes: number;
}

export interface Budgets {
  /** The entry script `index.html` loads. */
  entryGzipBytes: number;
  /** The entry plus every chunk `index.html` preloads with it. */
  initialGzipBytes: number;
  /** Named lazy chunks. Each must match at least one chunk, so a stale budget is noticed. */
  lazy: readonly LazyBudget[];
  /** Any lazy chunk no named budget matches. */
  otherLazyGzipBytes: number;
}

const KB = 1000;

// About 5% above the sizes measured when each budget was set (docs/conventions.md).
export const BUDGETS: Budgets = {
  entryGzipBytes: 168 * KB,
  initialGzipBytes: 249 * KB,
  lazy: [
    { label: 'monaco-setup', pattern: /^monaco-setup$/, maxGzipBytes: 1045 * KB },
    { label: 'editor.worker', pattern: /^editor\.worker$/, maxGzipBytes: 97 * KB },
    { label: 'elk (Mermaid layout)', pattern: /^elk-/, maxGzipBytes: 472 * KB },
    { label: 'editor-canvas', pattern: /^editor-canvas$/, maxGzipBytes: 61 * KB },
    { label: 'flow-editor', pattern: /^flow-editor$/, maxGzipBytes: 16 * KB },
    { label: 'class-editor', pattern: /^class-editor$/, maxGzipBytes: 20 * KB },
    { label: 'er-editor', pattern: /^er-editor$/, maxGzipBytes: 13.7 * KB },
    { label: 'state-editor', pattern: /^state-editor$/, maxGzipBytes: 18.5 * KB },
    { label: 'sequence-editor', pattern: /^sequence-editor$/, maxGzipBytes: 26 * KB },
    { label: 'compute-review', pattern: /^compute-review$/, maxGzipBytes: 3.3 * KB },
    { label: 'settings-fields', pattern: /^settings-fields$/, maxGzipBytes: 4 * KB },
    { label: 'motion (live fade)', pattern: /^mini$/, maxGzipBytes: 3.4 * KB },
  ],
  otherLazyGzipBytes: 150 * KB,
};

export interface Chunk {
  /** File name under `assets/`, e.g. `index-CkgOYHUK.js`. */
  file: string;
  gzipBytes: number;
}

export interface BuiltApp {
  entry: Chunk;
  /** The entry and its preloaded chunks. */
  initial: readonly Chunk[];
  lazy: readonly Chunk[];
}

/** Vite's output name `<name>-<8-character hash>.js`, without the hash and the extension. */
export function chunkName(file: string): string {
  return file.replace(/-[\w-]{8}\.js$/, '');
}

function scriptsIn(html: string): { entry: string; preloads: string[] } {
  const entry = /<script type="module"[^>]*src="\/assets\/([^"]+\.js)"/.exec(html)?.[1];
  if (entry === undefined) {
    throw new Error('index.html has no module script under /assets/: is this a Vite build?');
  }
  const preloads = [
    ...html.matchAll(/<link rel="modulepreload"[^>]*href="\/assets\/([^"]+\.js)"/g),
  ];
  return { entry, preloads: preloads.map((match) => match[1] ?? '') };
}

/** Reads a Vite build: which chunks load first, and every chunk's gzip size. */
export function readBuild(distDir: string): BuiltApp {
  const htmlPath = path.join(distDir, 'index.html');
  if (!existsSync(htmlPath)) {
    throw new Error(`No build at "${distDir}". Run \`pnpm --filter @nautink/web build\` first.`);
  }
  const { entry, preloads } = scriptsIn(readFileSync(htmlPath, 'utf8'));
  const assets = path.join(distDir, 'assets');
  const chunks: Chunk[] = readdirSync(assets)
    .filter((file) => file.endsWith('.js'))
    .map((file) => ({ file, gzipBytes: gzipSync(readFileSync(path.join(assets, file))).length }));
  const byFile = new Map(chunks.map((chunk) => [chunk.file, chunk]));
  const find = (file: string): Chunk => {
    const chunk = byFile.get(file);
    if (chunk === undefined) {
      throw new Error(`index.html loads "${file}", which is not in ${assets}.`);
    }
    return chunk;
  };
  const initial = [entry, ...preloads].map(find);
  const initialFiles = new Set(initial.map((chunk) => chunk.file));
  return {
    entry: find(entry),
    initial,
    lazy: chunks.filter((chunk) => !initialFiles.has(chunk.file)),
  };
}

const kb = (bytes: number): string => `${(bytes / KB).toFixed(2)} kB`;

function over(label: string, bytes: number, budget: number): string[] {
  return bytes > budget ? [`${label} is ${kb(bytes)} gzip, over its ${kb(budget)} budget`] : [];
}

function lazyFailures(lazy: readonly Chunk[], budgets: Budgets): string[] {
  const failures: string[] = [];
  for (const budget of budgets.lazy) {
    if (!lazy.some((chunk) => budget.pattern.test(chunkName(chunk.file)))) {
      failures.push(`the "${budget.label}" budget matches no lazy chunk: rename or remove it`);
    }
  }
  for (const chunk of lazy) {
    const budget = budgets.lazy.find((item) => item.pattern.test(chunkName(chunk.file)));
    const label =
      budget === undefined ? `lazy chunk ${chunk.file}` : `${budget.label} (${chunk.file})`;
    failures.push(
      ...over(label, chunk.gzipBytes, budget?.maxGzipBytes ?? budgets.otherLazyGzipBytes),
    );
  }
  return failures;
}

/** Every budget the build breaks, as one readable line each. Empty when it fits. */
export function checkBudgets(app: BuiltApp, budgets: Budgets): string[] {
  const initialBytes = app.initial.reduce((total, chunk) => total + chunk.gzipBytes, 0);
  return [
    ...over(`the entry script (${app.entry.file})`, app.entry.gzipBytes, budgets.entryGzipBytes),
    ...over('the initial JavaScript', initialBytes, budgets.initialGzipBytes),
    ...lazyFailures(app.lazy, budgets),
  ];
}

function main(): void {
  const distDir = path.join(import.meta.dirname, '..', 'apps', 'web', 'dist');
  const app = readBuild(distDir);
  const initialBytes = app.initial.reduce((total, chunk) => total + chunk.gzipBytes, 0);
  const failures = checkBudgets(app, BUDGETS);
  console.log(
    `Entry ${kb(app.entry.gzipBytes)} of ${kb(BUDGETS.entryGzipBytes)}, ` +
      `initial ${kb(initialBytes)} of ${kb(BUDGETS.initialGzipBytes)} (gzip), ` +
      `${String(app.lazy.length)} lazy chunks.`,
  );
  if (failures.length > 0) {
    console.error('Bundle budget check failed:');
    for (const failure of failures) {
      console.error(`  - ${failure}`);
    }
    console.error('Make it lazy or smaller, or raise the budget on purpose (docs/conventions.md).');
    process.exit(1);
  }
  console.log('Bundle budget check passed.');
}

if (process.argv[1]?.endsWith('check-bundle-budget.ts')) {
  main();
}
