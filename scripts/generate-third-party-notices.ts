#!/usr/bin/env node
/**
 * Writes THIRD_PARTY_NOTICES.md: every production dependency of apps/web and apps/server (followed
 * through the workspace packages they use), with its version, license and repository, plus the
 * bundled assets (icon sets, fonts) that need a note of their own.
 *
 * It is also the license gate: a license that is not on the permissive list, or cannot be read,
 * fails `--check` until the package is reviewed and added to REVIEWED.
 *
 * It reads the installed packages' package.json files, so run `pnpm install` first.
 *
 *   node scripts/generate-third-party-notices.ts                       # rewrite the file
 *   node scripts/generate-third-party-notices.ts --check               # exit 1 when out of date or a license fails
 *   node scripts/generate-third-party-notices.ts --web-licenses <file> # write the web build's license texts
 */
import { existsSync, readdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUTPUT = path.join(ROOT, 'THIRD_PARTY_NOTICES.md');
const ENTRY_APPS = ['apps/web', 'apps/server'] as const;
const WORKSPACE_SCOPE = '@nautink/';

export type AppName = 'web' | 'server';

interface PackageJson {
  name?: string;
  version?: string;
  license?: unknown;
  licenses?: unknown;
  repository?: unknown;
  homepage?: unknown;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

export interface Dependency {
  name: string;
  version: string;
  license: string;
  repository: string;
  /** The installed folder, where the package's own license file is. */
  dir: string;
  usedBy: Set<AppName>;
}

export interface Review {
  /** The license the review covers: a different license later fails the gate again. */
  license: string;
  reason: string;
}

interface IconSetInfo {
  name?: string;
  license?: { title?: string; spdx?: string; url?: string };
  author?: { name?: string; url?: string };
}

/** Licenses that only ask for the notice to be kept (or less). Anything else is listed for review. */
const PERMISSIVE = new Set([
  '0BSD',
  'Apache-2.0',
  'BlueOak-1.0.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'CC-BY-4.0',
  'CC0-1.0',
  'ISC',
  'MIT',
  'OFL-1.1',
  'Python-2.0',
  'Unlicense',
]);

/** Non-SPDX `license` strings seen in the tree, mapped to their SPDX id. */
const LICENSE_ALIASES: Record<string, string> = {
  'SIL OPEN FONT LICENSE': 'OFL-1.1',
};

/** Packages with a license outside PERMISSIVE that a human checked and accepted, and why. */
export const REVIEWED: Record<string, Review> = {
  elkjs: {
    license: 'EPL-2.0',
    reason:
      'weak copyleft at the file level; Nautink uses it unchanged, as a separate module, so only its own files stay under EPL-2.0',
  },
};

const LICENSE_FILE = /^(licen[cs]e|copying)(\.|-|$)/i;

const UNKNOWN = 'UNKNOWN';

function readPackageJson(dir: string): PackageJson {
  return JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8')) as PackageJson;
}

/** Node's lookup: `<dir>/node_modules/<name>`, walking up to the repo root. Symlinks resolved. */
function resolvePackageDir(root: string, fromDir: string, name: string): string | undefined {
  for (let dir = fromDir; dir.startsWith(root); dir = path.dirname(dir)) {
    const candidate = path.join(dir, 'node_modules', name);
    if (existsSync(path.join(candidate, 'package.json'))) {
      return realpathSync(candidate);
    }
    if (dir === root) {
      break;
    }
  }
  return undefined;
}

function licenseFromField(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim() !== '') {
    return LICENSE_ALIASES[value.trim()] ?? value.trim();
  }
  if (typeof value === 'object' && value !== null && 'type' in value) {
    return licenseFromField((value as { type: unknown }).type);
  }
  if (Array.isArray(value)) {
    const types = value.map(licenseFromField).filter((type) => type !== undefined);
    return types.length > 0 ? `(${types.join(' OR ')})` : undefined;
  }
  return undefined;
}

/** For packages with no `license` field: recognise an MIT license file, the common case. */
function licenseFromFile(dir: string): string | undefined {
  const file = readdirSync(dir).find((entry) => LICENSE_FILE.test(entry));
  if (file === undefined) {
    return undefined;
  }
  const text = readFileSync(path.join(dir, file), 'utf8');
  return text.includes('Permission is hereby granted, free of charge') ? 'MIT' : undefined;
}

function licenseOf(dir: string, pkg: PackageJson): string {
  return (
    licenseFromField(pkg.license) ??
    licenseFromField(pkg.licenses) ??
    licenseFromFile(dir) ??
    UNKNOWN
  );
}

/** `git+https://github.com/a/b.git`, `github:a/b`, `a/b` → `https://github.com/a/b`. */
function normalizeRepository(url: string): string {
  const shorthand = /^(?:github:)?([\w.-]+\/[\w.-]+)$/.exec(url);
  if (shorthand?.[1] !== undefined) {
    return `https://github.com/${shorthand[1]}`;
  }
  return url
    .replace(/^git\+/, '')
    .replace(/^git:\/\//, 'https://')
    .replace(/^ssh:\/\/git@/, 'https://')
    .replace(/^git@github\.com:/, 'https://github.com/')
    .replace(/\.git$/, '');
}

function repositoryOf(pkg: PackageJson, name: string): string {
  const field = pkg.repository;
  const url =
    typeof field === 'object' && field !== null && 'url' in field
      ? (field as { url: unknown }).url
      : field;
  if (typeof url === 'string' && url !== '') {
    return normalizeRepository(url);
  }
  if (typeof pkg.homepage === 'string' && pkg.homepage !== '') {
    return pkg.homepage;
  }
  return `https://www.npmjs.com/package/${name}`;
}

function isPermissive(license: string): boolean {
  const alternatives = license.replace(/^\(|\)$/g, '').split(/\s+OR\s+/);
  return alternatives.some((alternative) => PERMISSIVE.has(alternative.trim()));
}

function productionDependencies(pkg: PackageJson): { name: string; isOptional: boolean }[] {
  return [
    ...Object.keys(pkg.dependencies ?? {}).map((name) => ({ name, isOptional: false })),
    ...Object.keys(pkg.optionalDependencies ?? {}).map((name) => ({ name, isOptional: true })),
  ];
}

/** The installed folders of a package's production dependencies. Throws when a required one is missing. */
function dependencyDirs(root: string, dir: string): { name: string; dir: string }[] {
  const dirs: { name: string; dir: string }[] = [];
  for (const dependency of productionDependencies(readPackageJson(dir))) {
    const depDir = resolvePackageDir(root, dir, dependency.name);
    if (depDir !== undefined) {
      dirs.push({ name: dependency.name, dir: depDir });
    } else if (!dependency.isOptional) {
      throw new Error(`Cannot find "${dependency.name}" (needed by ${dir}). Run pnpm install.`);
    }
  }
  return dirs;
}

/** Every folder reachable from `appDir` through production dependencies, workspace packages included. */
function reachableDirs(root: string, appDir: string): Map<string, string> {
  const reached = new Map<string, string>();
  const queue: string[] = [path.join(root, appDir)];
  for (let dir = queue.shift(); dir !== undefined; dir = queue.shift()) {
    for (const dependency of dependencyDirs(root, dir)) {
      if (!reached.has(dependency.dir)) {
        reached.set(dependency.dir, dependency.name);
        queue.push(dependency.dir);
      }
    }
  }
  return reached;
}

function describeDependency(dir: string, name: string, app: AppName): Dependency {
  const pkg = readPackageJson(dir);
  return {
    name: pkg.name ?? name,
    version: pkg.version ?? UNKNOWN,
    license: licenseOf(dir, pkg),
    repository: repositoryOf(pkg, name),
    dir,
    usedBy: new Set([app]),
  };
}

/** Every third-party package reachable from the two apps through `dependencies`, keyed by folder. */
export function collectDependencies(root: string = ROOT): Dependency[] {
  const found = new Map<string, Dependency>();
  for (const appDir of ENTRY_APPS) {
    const app: AppName = appDir === 'apps/web' ? 'web' : 'server';
    for (const [dir, name] of reachableDirs(root, appDir)) {
      if (name.startsWith(WORKSPACE_SCOPE)) {
        continue;
      }
      const known = found.get(dir);
      if (known === undefined) {
        found.set(dir, describeDependency(dir, name, app));
      } else {
        known.usedBy.add(app);
      }
    }
  }
  return [...found.values()].sort(
    (a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version),
  );
}

function isReviewed(dependency: Dependency, reviewed: Record<string, Review>): boolean {
  return reviewed[dependency.name]?.license === dependency.license;
}

/** One line per package whose license is neither permissive nor reviewed under that license. */
export function licenseProblems(
  dependencies: Dependency[],
  reviewed: Record<string, Review>,
): string[] {
  return dependencies
    .filter((dependency) => !isPermissive(dependency.license))
    .filter((dependency) => !isReviewed(dependency, reviewed))
    .map(
      (dependency) =>
        `${dependency.name} ${dependency.version}: ${dependency.license} (${dependency.repository})`,
    );
}

function licenseTextOf(dependency: Dependency): string {
  const file = readdirSync(dependency.dir).find((entry) => LICENSE_FILE.test(entry));
  if (file === undefined) {
    return `The package ships no license file. Its license is ${dependency.license}: see ${dependency.repository}.`;
  }
  return readFileSync(path.join(dependency.dir, file), 'utf8').trim();
}

/**
 * The text file served beside the built web app: Nautink's own license, then every package the web
 * app ships with that package's own license text, as the MIT and BSD licenses ask of a copy.
 */
export function renderLicenseTexts(dependencies: Dependency[], ownLicense: string): string {
  const rule = '-'.repeat(80);
  const sections = dependencies
    .filter((dependency) => dependency.usedBy.has('web'))
    .map(
      (dependency) =>
        `${rule}\n${dependency.name} ${dependency.version} (${dependency.license})\n${dependency.repository}\n\n${licenseTextOf(dependency)}\n`,
    );
  return [
    ownLicense.trim(),
    '',
    'Nautink includes the third-party software below. Each package keeps its own license.',
    '',
    ...ATTRIBUTION,
    '',
    ...sections,
  ].join('\n');
}

function findDependency(dependencies: Dependency[], name: string): Dependency {
  const match = dependencies.find((dependency) => dependency.name === name);
  if (match === undefined) {
    throw new Error(
      `"${name}" is no longer a production dependency; update the bundled assets list.`,
    );
  }
  return match;
}

function iconSetRow(dependencies: Dependency[], name: string): string {
  const dependency = findDependency(dependencies, name);
  const dir = resolvePackageDir(ROOT, path.join(ROOT, 'apps/web'), name);
  if (dir === undefined) {
    throw new Error(`Cannot find "${name}" from apps/web.`);
  }
  const info = JSON.parse(readFileSync(path.join(dir, 'info.json'), 'utf8')) as IconSetInfo;
  const author = info.author?.name ?? UNKNOWN;
  const source = info.author?.url ?? dependency.repository;
  return `| ${info.name ?? name} (\`${name}\` ${dependency.version}) | ${info.license?.spdx ?? dependency.license} | ${author} | ${source} |`;
}

const ICON_SETS = [
  '@iconify-json/logos',
  '@iconify-json/mdi',
  '@iconify-json/fa6-solid',
  '@iconify-json/fa6-brands',
  '@iconify-json/carbon',
];

/** Credit the bundled icon sets and fonts ask for, in Markdown; also copied into the web build. */
const ATTRIBUTION = [
  '- **Font Awesome Free 6** icons (`fa6-solid`, `fa6-brands`) by Fonticons, Inc.,',
  '  https://fontawesome.com, are licensed under',
  '  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). They are used unchanged, as Iconify',
  '  JSON data. Font Awesome brand icons are trademarks of their respective owners.',
  '- **Material Design Icons** by Pictogrammers and **Carbon icons** by IBM are licensed under',
  '  Apache-2.0.',
  '- **SVG Logos** by Gil Barbara are released under CC0 1.0. The logos themselves are trademarks of',
  '  their respective owners; their use here does not imply endorsement.',
  '- **Geist** fonts are licensed under the SIL Open Font License 1.1; the license text ships in the',
  '  `geist` package (`LICENSE.txt`).',
];

function bundledAssets(dependencies: Dependency[]): string[] {
  const geist = findDependency(dependencies, 'geist');
  const mermaid = findDependency(dependencies, 'mermaid');
  const monaco = findDependency(dependencies, 'monaco-editor');
  return [
    '## Bundled assets',
    '',
    'These ship inside the built web app and carry their own terms:',
    '',
    '| Asset | License | Author | Source |',
    '| --- | --- | --- | --- |',
    ...ICON_SETS.map((name) => iconSetRow(dependencies, name)),
    `| Geist and Geist Mono fonts (\`geist\` ${geist.version}) | ${geist.license} | Vercel, with basement.studio | ${geist.repository} |`,
    `| Mermaid (\`mermaid\` ${mermaid.version}) | ${mermaid.license} | Knut Sveidqvist and contributors | ${mermaid.repository} |`,
    `| Monaco Editor (\`monaco-editor\` ${monaco.version}) | ${monaco.license} | Microsoft | ${monaco.repository} |`,
    '',
    '### Attribution',
    '',
    ...ATTRIBUTION,
    '',
  ];
}

function licenseSummary(dependencies: Dependency[]): string[] {
  const counts = new Map<string, number>();
  for (const dependency of dependencies) {
    counts.set(dependency.license, (counts.get(dependency.license) ?? 0) + 1);
  }
  const rows = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([license, count]) => `| ${license} | ${String(count)} |`);
  return ['## Licenses at a glance', '', '| License | Packages |', '| --- | --- |', ...rows, ''];
}

function reviewRow(dependency: Dependency): string {
  const row = `- \`${dependency.name}\` ${dependency.version}: ${dependency.license} (${dependency.repository}).`;
  if (!isReviewed(dependency, REVIEWED)) {
    return `${row} Not reviewed.`;
  }
  return `${row} Reviewed: ${REVIEWED[dependency.name]?.reason ?? ''}.`;
}

function reviewSection(dependencies: Dependency[]): string[] {
  const flagged = dependencies.filter((dependency) => !isPermissive(dependency.license));
  const rows = flagged.length === 0 ? ['None.'] : flagged.map(reviewRow);
  return [
    '## Licenses to review',
    '',
    'Packages whose license is not on the permissive list in',
    '`scripts/generate-third-party-notices.ts`, or could not be read. `--check` fails until each one',
    'is reviewed:',
    '',
    ...rows,
    '',
  ];
}

function dependencyTable(dependencies: Dependency[]): string[] {
  const rows = dependencies.map(
    (dependency) =>
      `| ${dependency.name} | ${dependency.version} | ${dependency.license} | ${[...dependency.usedBy].sort().join(', ')} | ${dependency.repository} |`,
  );
  return [
    '## Production dependencies',
    '',
    '| Package | Version | License | Used by | Repository |',
    '| --- | --- | --- | --- | --- |',
    ...rows,
    '',
  ];
}

function render(dependencies: Dependency[]): string {
  return [
    '# Third-party notices',
    '',
    'Nautink is MIT licensed (see `LICENSE`). It is built on the open-source packages below. Each',
    "package's full license text ships with the package itself (its `LICENSE` file on npm and in its",
    'repository).',
    '',
    `This file lists the ${String(dependencies.length)} third-party packages that \`apps/web\` and`,
    '`apps/server` depend on at runtime, directly or through the workspace packages. Development',
    'tools (test runners, linters, build tools) are not listed: they are not shipped.',
    '',
    'Generated by `node scripts/generate-third-party-notices.ts`. Do not edit by hand.',
    '',
    ...bundledAssets(dependencies),
    ...licenseSummary(dependencies),
    ...reviewSection(dependencies),
    ...dependencyTable(dependencies),
  ].join('\n');
}

function writeWebLicenses(dependencies: Dependency[], output: string | undefined): void {
  if (output === undefined || output.startsWith('--')) {
    throw new Error('--web-licenses needs the path of the file to write.');
  }
  const ownLicense = readFileSync(path.join(ROOT, 'LICENSE'), 'utf8');
  writeFileSync(output, renderLicenseTexts(dependencies, ownLicense));
  console.log(`Wrote ${output}.`);
}

function check(dependencies: Dependency[]): void {
  const failures: string[] = [];
  const current = existsSync(OUTPUT) ? readFileSync(OUTPUT, 'utf8') : '';
  if (current !== render(dependencies)) {
    failures.push(
      'THIRD_PARTY_NOTICES.md is out of date. Run: node scripts/generate-third-party-notices.ts',
    );
  }
  const problems = licenseProblems(dependencies, REVIEWED);
  if (problems.length > 0) {
    failures.push(
      'These licenses are not on the permissive list. Replace the package, or review it and add it to REVIEWED:',
      ...problems.map((problem) => `  - ${problem}`),
    );
  }
  if (failures.length > 0) {
    console.error(failures.join('\n'));
    process.exit(1);
  }
  console.log(
    `THIRD_PARTY_NOTICES.md is up to date; all ${String(dependencies.length)} licenses pass.`,
  );
}

function main(): void {
  const dependencies = collectDependencies();
  const webLicensesFlag = process.argv.indexOf('--web-licenses');
  if (webLicensesFlag !== -1) {
    writeWebLicenses(dependencies, process.argv[webLicensesFlag + 1]);
  } else if (process.argv.includes('--check')) {
    check(dependencies);
  } else {
    writeFileSync(OUTPUT, render(dependencies));
    console.log(`Wrote ${path.relative(ROOT, OUTPUT)}.`);
  }
}

if (process.argv[1]?.endsWith('generate-third-party-notices.ts')) {
  main();
}
