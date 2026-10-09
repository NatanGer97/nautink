import assert from 'node:assert/strict';
import test from 'node:test';

import { HOW_TO_ADD_ONE, decide } from './check-changeset.mjs';

test('a source change with no changeset fails and says how to add one', () => {
  const result = decide(['packages/core/src/diagram.ts', 'packages/core/src/diagram.test.ts']);

  assert.equal(result.exitCode, 1);
  assert.ok(result.message.includes(HOW_TO_ADD_ONE));
  assert.ok(result.message.includes('packages/core/src/diagram.ts'));
});

test('the same source change with a changeset passes', () => {
  const result = decide(['packages/core/src/diagram.ts', '.changeset/brave-otters-sing.md']);

  assert.equal(result.exitCode, 0);
});

test('a change to apps counts as source too', () => {
  assert.equal(decide(['apps/web/src/app/page.tsx']).exitCode, 1);
});

test('docs, Markdown and workflow changes need no changeset', () => {
  const result = decide([
    'docs/adr/0021-changesets.md',
    'README.md',
    '.github/workflows/ci.yml',
    'package.json',
  ]);

  assert.equal(result.exitCode, 0);
});

test('the changeset README and config are not changesets', () => {
  const result = decide([
    'packages/shared/src/index.ts',
    '.changeset/README.md',
    '.changeset/config.json',
  ]);

  assert.equal(result.exitCode, 1);
});

test('an empty changed-file list passes', () => {
  assert.equal(decide([]).exitCode, 0);
});
