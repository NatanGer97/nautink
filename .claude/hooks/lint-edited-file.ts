#!/usr/bin/env node
/**
 * Claude Code PostToolUse hook: formats and lints every file an agent writes.
 * The checking itself lives in scripts/lint-file.mjs, which every harness shares;
 * this file is only the stdin payload adapter.
 * Exits 2 with the ESLint output on stderr so the agent fixes the violation in the same turn.
 */
import process from 'node:process';

import { BLOCKING_EXIT_CODE, checkFile } from '../../scripts/lint-file.ts';

interface HookPayload {
  tool_input?: { file_path?: unknown };
}

async function readHookPayload(): Promise<HookPayload> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  return raw === '' ? {} : (JSON.parse(raw) as HookPayload);
}

async function main(): Promise<void> {
  const payload = await readHookPayload();
  const report = await checkFile(payload.tool_input?.file_path);
  if (report !== '') {
    console.error(report);
    process.exit(BLOCKING_EXIT_CODE);
  }
}

try {
  await main();
} catch (err) {
  // A broken hook must never block the agent: report the failure and let the turn continue.
  console.error(
    `lint-edited-file hook failed: ${err instanceof Error ? err.message : String(err)}`,
  );
}
