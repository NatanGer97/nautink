import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { BUDGETS, checkBudgets, chunkName, readBuild } from './check-bundle-budget.ts';

import type { BuiltApp, Budgets, Chunk } from './check-bundle-budget.ts';

// Proves the bundle budget still fires: on a fake Vite build with chunks of known size, and on the
// repo's own budgets, so loosening or breaking a budget cannot pass in silence.

const SMALL: Budgets = {
  entryGzipBytes: 1000,
  initialGzipBytes: 1500,
  lazy: [{ label: 'flow-editor', pattern: /^flow-editor$/, maxGzipBytes: 500 }],
  otherLazyGzipBytes: 800,
};

function chunk(file: string, gzipBytes: number): Chunk {
  return { file, gzipBytes };
}

function app(sizes: {
  entry?: number;
  preload?: number;
  editor?: number;
  other?: number;
}): BuiltApp {
  const entry = chunk('index-AbCd1234.js', sizes.entry ?? 900);
  return {
    entry,
    initial: [entry, chunk('react-AbCd1234.js', sizes.preload ?? 100)],
    lazy: [
      chunk('flow-editor-Xy_z-123.js', sizes.editor ?? 400),
      chunk('katex-QwErTy12.js', sizes.other ?? 700),
    ],
  };
}

test('a build inside every budget passes', () => {
  assert.deepEqual(checkBudgets(app({}), SMALL), []);
});

test('an entry over its budget fails', () => {
  const failures = checkBudgets(app({ entry: 1001 }), SMALL);
  assert.equal(failures.length, 1);
  assert.match(failures[0] ?? '', /entry script \(index-AbCd1234\.js\) is 1\.00 kB/);
});

test('the initial JavaScript over its budget fails, even with the entry inside its own', () => {
  assert.match(checkBudgets(app({ preload: 700 }), SMALL).join('\n'), /initial JavaScript/);
});

test('a named lazy chunk over its budget fails', () => {
  assert.match(checkBudgets(app({ editor: 501 }), SMALL).join('\n'), /flow-editor \(flow-editor-/);
});

test('any other lazy chunk over the default budget fails', () => {
  assert.match(
    checkBudgets(app({ other: 801 }), SMALL).join('\n'),
    /lazy chunk katex-QwErTy12\.js/,
  );
});

test('a budget that matches no chunk fails, so a renamed chunk is noticed', () => {
  const stale: Budgets = {
    ...SMALL,
    lazy: [...SMALL.lazy, { label: 'gone', pattern: /^gone$/, maxGzipBytes: 1 }],
  };
  assert.match(checkBudgets(app({}), stale).join('\n'), /"gone" budget matches no lazy chunk/);
});

test("the repo's own budgets fire one byte over", () => {
  const monacoBudget = BUDGETS.lazy.find((budget) => budget.label === 'monaco-setup');
  assert.ok(monacoBudget);
  const entry = chunk('index-AbCd1234.js', BUDGETS.entryGzipBytes + 1);
  const monaco = chunk('monaco-setup-AbCd1234.js', monacoBudget.maxGzipBytes + 1);
  const failures = checkBudgets({ entry, initial: [entry], lazy: [monaco] }, BUDGETS).join('\n');
  assert.match(failures, /entry script/);
  assert.match(failures, /monaco-setup \(monaco-setup-/);
});

test('chunk names drop only the content hash', () => {
  assert.equal(chunkName('elk-IJKZMXRS-DqCaWcsS.js'), 'elk-IJKZMXRS');
  assert.equal(chunkName('sequence-editor-BDLpY-Dl.js'), 'sequence-editor');
  assert.equal(chunkName('editor.worker-BmdWdrHZ.js'), 'editor.worker');
});

test('reads a Vite build: the entry and its preloads load first, the rest is lazy', () => {
  const dist = mkdtempSync(path.join(tmpdir(), 'bundle-budget-'));
  try {
    mkdirSync(path.join(dist, 'assets'));
    writeFileSync(
      path.join(dist, 'index.html'),
      '<script type="module" crossorigin src="/assets/index-AbCd1234.js"></script>' +
        '<link rel="modulepreload" crossorigin href="/assets/react-AbCd1234.js">',
    );
    // Random bytes do not compress, so each file's gzip size is a little over its length.
    writeFileSync(path.join(dist, 'assets', 'index-AbCd1234.js'), randomBytes(2000));
    writeFileSync(path.join(dist, 'assets', 'react-AbCd1234.js'), randomBytes(10));
    writeFileSync(path.join(dist, 'assets', 'katex-QwErTy12.js'), randomBytes(10));
    const built = readBuild(dist);
    assert.equal(built.entry.file, 'index-AbCd1234.js');
    assert.ok(built.entry.gzipBytes > 2000);
    assert.deepEqual(
      built.initial.map((item) => item.file),
      ['index-AbCd1234.js', 'react-AbCd1234.js'],
    );
    assert.deepEqual(
      built.lazy.map((item) => item.file),
      ['katex-QwErTy12.js'],
    );
    assert.match(checkBudgets(built, SMALL).join('\n'), /entry script/);
  } finally {
    rmSync(dist, { recursive: true, force: true });
  }
});

test('a missing build is an explicit error, not a pass', () => {
  assert.throws(() => readBuild(path.join(tmpdir(), 'no-such-build')), /No build at/);
});
