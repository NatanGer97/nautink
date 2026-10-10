import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  collectDependencies,
  licenseProblems,
  REVIEWED,
  renderLicenseTexts,
} from './generate-third-party-notices.ts';

import type { Dependency } from './generate-third-party-notices.ts';

// Proves the license gate still fires: on a fake install with packages of known licenses, and on
// the repo's own dependencies, so a copyleft or unreadable license cannot slip in unnoticed.

const MIT_TEXT =
  'Copyright (c) Someone\n\nPermission is hereby granted, free of charge, to any person';

function dependency(name: string, license: string): Dependency {
  return {
    name,
    version: '1.0.0',
    license,
    repository: `https://github.com/example/${name}`,
    dir: `/nowhere/${name}`,
    usedBy: new Set(['web']),
  };
}

function writePackage(dir: string, json: object, files: Record<string, string> = {}): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'package.json'), JSON.stringify(json));
  for (const [file, text] of Object.entries(files)) {
    writeFileSync(path.join(dir, file), text);
  }
}

/** A repo with apps/web and apps/server, and the given packages installed at the root. */
function fakeRepo(
  webDependencies: string[],
  packages: { name: string; json: object; files?: Record<string, string> }[],
): string {
  // Real path: on macOS the temp folder is behind a symlink, and the lookup compares resolved paths.
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'third-party-')));
  const dependencies = Object.fromEntries(webDependencies.map((name) => [name, '^1.0.0']));
  writePackage(path.join(root, 'apps', 'web'), { name: '@nautink/web', dependencies });
  writePackage(path.join(root, 'apps', 'server'), { name: '@nautink/server' });
  for (const item of packages) {
    writePackage(path.join(root, 'node_modules', item.name), item.json, item.files);
  }
  return root;
}

test('permissive licenses pass', () => {
  assert.deepEqual(
    licenseProblems([dependency('a', 'MIT'), dependency('b', '(MPL-2.0 OR Apache-2.0)')], {}),
    [],
  );
});

test('a copyleft license fails', () => {
  const problems = licenseProblems([dependency('gpl-thing', 'GPL-3.0-only')], {});
  assert.equal(problems.length, 1);
  assert.match(problems[0] ?? '', /gpl-thing 1\.0\.0: GPL-3\.0-only/);
});

test('an unreadable license fails', () => {
  assert.match(licenseProblems([dependency('mystery', 'UNKNOWN')], {}).join('\n'), /mystery/);
});

test('a reviewed package passes only under the license it was reviewed for', () => {
  const reviewed = { elkjs: { license: 'EPL-2.0', reason: 'used unchanged' } };
  assert.deepEqual(licenseProblems([dependency('elkjs', 'EPL-2.0')], reviewed), []);
  assert.match(
    licenseProblems([dependency('elkjs', 'GPL-3.0-only')], reviewed).join('\n'),
    /elkjs 1\.0\.0: GPL-3\.0-only/,
  );
});

test("the repo's own dependencies pass the gate", () => {
  assert.deepEqual(licenseProblems(collectDependencies(), REVIEWED), []);
});

test('collects the license of every package an app reaches, through its dependencies', () => {
  const root = fakeRepo(
    ['a'],
    [
      {
        name: 'a',
        json: { name: 'a', version: '1.0.0', license: 'MIT', dependencies: { b: '1' } },
      },
      { name: 'b', json: { name: 'b', version: '2.0.0', license: 'GPL-3.0-only' } },
    ],
  );
  try {
    const found = collectDependencies(root);
    assert.deepEqual(
      found.map((item) => `${item.name}@${item.version} ${item.license}`),
      ['a@1.0.0 MIT', 'b@2.0.0 GPL-3.0-only'],
    );
    assert.match(licenseProblems(found, {}).join('\n'), /b 2\.0\.0: GPL-3\.0-only/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("the web license file carries each package's own license text", () => {
  const root = fakeRepo(
    ['a', 'no-file'],
    [
      {
        name: 'a',
        json: { name: 'a', version: '1.0.0', license: 'MIT' },
        files: { LICENSE: MIT_TEXT },
      },
      { name: 'no-file', json: { name: 'no-file', version: '3.0.0', license: 'ISC' } },
    ],
  );
  try {
    const text = renderLicenseTexts(collectDependencies(root), 'NAUTINK LICENSE');
    assert.match(text, /^NAUTINK LICENSE/);
    assert.match(text, /Font Awesome Free 6[^]*CC BY 4\.0/);
    assert.match(text, /a 1\.0\.0 \(MIT\)\n[^]*Permission is hereby granted/);
    assert.match(text, /no-file 3\.0\.0 \(ISC\)\n[^]*ships no license file/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('the web license file leaves out server-only packages', () => {
  const server: Dependency = { ...dependency('express', 'MIT'), usedBy: new Set(['server']) };
  assert.doesNotMatch(renderLicenseTexts([server], 'NAUTINK LICENSE'), /express/);
});
