import assert from 'node:assert/strict';
import test from 'node:test';

import { changelogSection, releaseNotes, releaseVersion } from './tag-release.ts';

// The release script tags the whole app once (`v0.1.0`), so every workspace must share one version
// and the release notes come from each workspace's changelog section for it.

const WEB_CHANGELOG = `# @nautink/web

## 0.2.0

### Minor Changes

- abc1234: Export a diagram as PDF.

## 0.1.0

### Minor Changes

- def5678: The first release.
`;

test('one shared version is the release version', () => {
  assert.equal(
    releaseVersion([
      { name: '@nautink/web', version: '0.1.0' },
      { name: '@nautink/server', version: '0.1.0' },
    ]),
    '0.1.0',
  );
});

test('workspaces on different versions are an explicit error', () => {
  assert.throws(
    () =>
      releaseVersion([
        { name: '@nautink/web', version: '0.2.0' },
        { name: '@nautink/server', version: '0.1.0' },
      ]),
    /@nautink\/web 0\.2\.0, @nautink\/server 0\.1\.0/,
  );
});

test('no workspaces is an explicit error', () => {
  assert.throws(() => releaseVersion([]), /No workspaces/);
});

test("a changelog's section for a version stops at the next version", () => {
  const section = changelogSection(WEB_CHANGELOG, '0.2.0');
  assert.equal(section, '### Minor Changes\n\n- abc1234: Export a diagram as PDF.');
});

test('the last section runs to the end of the file', () => {
  assert.equal(
    changelogSection(WEB_CHANGELOG, '0.1.0'),
    '### Minor Changes\n\n- def5678: The first release.',
  );
});

test('a version with no section has none', () => {
  assert.equal(changelogSection(WEB_CHANGELOG, '9.9.9'), undefined);
  assert.equal(changelogSection(WEB_CHANGELOG, '0.1'), undefined);
});

test('release notes list each workspace that changed, under its name', () => {
  const notes = releaseNotes('0.2.0', [
    { name: '@nautink/web', changelog: WEB_CHANGELOG },
    { name: '@nautink/server', changelog: '# @nautink/server\n\n## 0.1.0\n\n- Old.\n' },
  ]);
  assert.match(
    notes,
    /^## @nautink\/web\n\n### Minor Changes\n\n- abc1234: Export a diagram as PDF\./,
  );
  assert.doesNotMatch(notes, /@nautink\/server/);
});

test('release notes with no changed workspace say so', () => {
  assert.equal(
    releaseNotes('0.3.0', [{ name: '@nautink/web', changelog: WEB_CHANGELOG }]),
    'No changes.',
  );
});
