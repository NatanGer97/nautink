import assert from 'node:assert/strict';
import { test } from 'node:test';

import { planWrites, rulesetName, unmanaged } from './apply-rulesets.ts';

test('rulesetName reads the name and rejects a file without one', () => {
  assert.equal(rulesetName('{"name":"main"}', 'main.json'), 'main');
  assert.throws(() => rulesetName('{}', 'x.json'), /x\.json has no "name"/);
  assert.throws(() => rulesetName('{"name":""}', 'x.json'), /x\.json has no "name"/);
});

test('planWrites updates a live ruleset of the same name and creates a new one', () => {
  const writes = planWrites(
    [
      { name: 'main', body: 'A' },
      { name: 'release tags', body: 'B' },
    ],
    [{ id: 7, name: 'main' }],
  );
  assert.deepEqual(writes, [
    { method: 'PUT', endpoint: 'repos/{owner}/{repo}/rulesets/7', name: 'main', body: 'A' },
    { method: 'POST', endpoint: 'repos/{owner}/{repo}/rulesets', name: 'release tags', body: 'B' },
  ]);
});

test('planWrites rejects two files with the same name', () => {
  assert.throws(
    () =>
      planWrites(
        [
          { name: 'main', body: 'A' },
          { name: 'main', body: 'B' },
        ],
        [],
      ),
    /share the name "main"/,
  );
});

test('unmanaged lists live rulesets no file names', () => {
  assert.deepEqual(
    unmanaged(
      [{ name: 'main' }],
      [
        { id: 1, name: 'main' },
        { id: 2, name: 'old' },
      ],
    ),
    [{ id: 2, name: 'old' }],
  );
});
