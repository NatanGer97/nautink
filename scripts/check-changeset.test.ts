import assert from 'node:assert/strict';
import test from 'node:test';

import { HOW_TO_ADD_ONE, decide } from './check-changeset.ts';

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

test('the marketing page needs no changeset: it is not part of the released app', () => {
  assert.equal(decide(['apps/site/index.html', 'apps/site/src/tabs.ts']).exitCode, 0);
});

test('the marketing page next to an app change still needs one, for the app', () => {
  const result = decide(['apps/site/index.html', 'apps/web/src/app/page.tsx']);

  assert.equal(result.exitCode, 1);
  assert.ok(result.message.includes('apps/web/src/app/page.tsx'));
  assert.ok(!result.message.includes('apps/site/index.html'));
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
