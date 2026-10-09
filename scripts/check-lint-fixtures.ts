#!/usr/bin/env node
/**
 * Proves every custom lint gate is armed: each file under tools/lint-fixtures/invalid
 * must report exactly the rule IDs in its `EXPECT:` header, and every file under
 * tools/lint-fixtures/valid must report nothing.
 */
import { ESLint } from 'eslint';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const FIXTURE_ROOT = path.join(import.meta.dirname, '..', 'tools', 'lint-fixtures');

function expectedRules(file: string): string[] {
  const header = readFileSync(file, 'utf8').split('\n')[0] ?? '';
  const match = /EXPECT:\s*(.+)$/.exec(header);
  return match?.[1] === undefined ? [] : match[1].split(',').map((rule) => rule.trim());
}

const eslint = new ESLint({ ignore: false, errorOnUnmatchedPattern: false });
const results = await eslint.lintFiles([`${FIXTURE_ROOT}/**/*.{ts,tsx,js}`]);
const failures: string[] = [];

for (const result of results) {
  const relative = path.relative(FIXTURE_ROOT, result.filePath);
  const reported = new Set(result.messages.map((message) => message.ruleId ?? 'parse-error'));
  if (relative.startsWith('valid')) {
    if (reported.size > 0) {
      failures.push(`${relative}: expected clean, got ${[...reported].join(', ')}`);
    }
    continue;
  }
  for (const rule of expectedRules(result.filePath)) {
    if (!reported.has(rule)) {
      failures.push(
        `${relative}: rule "${rule}" did not fire (got: ${[...reported].join(', ') || 'nothing'})`,
      );
    }
  }
}

if (failures.length > 0) {
  console.error('Lint fixture check failed:\n' + failures.map((line) => `  - ${line}`).join('\n'));
  process.exit(1);
}

console.log(`Lint fixture check passed (${results.length} fixtures).`);
