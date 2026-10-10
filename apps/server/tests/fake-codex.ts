#!/usr/bin/env node
/**
 * A stand-in for the Codex CLI, run by the tests through `CODEX_BIN`. It answers `--version` and
 * `debug models`, and for `exec` prints `--json` lines for the scenario named in
 * `FAKE_CODEX_SCENARIO`. When `FAKE_CODEX_RECORD` names a file it writes its argv, cwd, stdin and pid
 * there first.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import process from 'node:process';
import { setTimeout as sleep } from 'node:timers/promises';

const THREAD_ID = 'fake-thread-1';
const HANG_MS = 60_000;

type Line = Record<string, unknown>;

const thread: Line = { type: 'thread.started', thread_id: THREAD_ID };
const turnStarted: Line = { type: 'turn.started' };
const completed: Line = { type: 'turn.completed', usage: { input_tokens: 10, output_tokens: 2 } };

function message(text: string): Line {
  return { type: 'item.completed', item: { id: 'm', type: 'agent_message', text } };
}

function command(type: string, cmd: string): Line {
  return { type, item: { id: 'c', type: 'command_execution', command: cmd, status: 'x' } };
}

const SCENARIOS: Record<string, Line[]> = {
  reply: [thread, turnStarted, message('Here is the diagram.'), completed],
  tool: [
    thread,
    turnStarted,
    message('Looking.'),
    command('item.started', '/bin/zsh -lc "rg login src"'),
    command('item.completed', '/bin/zsh -lc "rg login src"'),
    message('Done.'),
    completed,
  ],
  failed: [thread, turnStarted, { type: 'turn.failed', error: { message: 'model not found' } }],
};

const CATALOG = {
  models: [
    { slug: 'gpt-6-astra', display_name: 'GPT-6-Astra', visibility: 'list' },
    { slug: 'gpt-hidden', display_name: 'Hidden', visibility: 'hide' },
    { slug: 'gpt-5.6-luna', display_name: 'GPT-5.6-Luna', visibility: 'list' },
  ],
};

function write(line: Line | string): void {
  process.stdout.write(`${typeof line === 'string' ? line : JSON.stringify(line)}\n`);
}

function isExec(): boolean {
  return process.argv[2] === 'exec';
}

function record(): void {
  const recordPath = process.env.FAKE_CODEX_RECORD;
  if (recordPath === undefined) {
    return;
  }
  const stdin = isExec() ? readFileSync(0, 'utf8') : '';
  const argv = process.argv.slice(2);
  writeFileSync(recordPath, JSON.stringify({ argv, cwd: process.cwd(), stdin, pid: process.pid }));
}

async function version(scenario: string): Promise<void> {
  if (scenario === 'version-fail') {
    process.stderr.write('version check exploded\n');
    process.exit(2);
  }
  if (scenario === 'hang') {
    await sleep(HANG_MS);
  }
  write('codex-cli 0.154.0');
}

function models(scenario: string): void {
  if (scenario === 'models-fail') {
    process.stderr.write('no catalog\n');
    process.exit(1);
  }
  write(scenario === 'models-bad' ? '{"models": "nope"}' : JSON.stringify(CATALOG));
}

async function run(scenario: string): Promise<void> {
  if (scenario === 'crash') {
    process.stderr.write('Not logged in. Run codex login.\n');
    process.exit(1);
  } else if (scenario === 'hang') {
    write(thread);
    await sleep(HANG_MS);
  } else {
    for (const line of SCENARIOS[scenario] ?? SCENARIOS.reply!) {
      write(line);
    }
  }
}

const scenario = process.env.FAKE_CODEX_SCENARIO ?? 'reply';
record();
if (process.argv.includes('--version')) {
  await version(scenario);
} else if (process.argv[2] === 'debug' && process.argv[3] === 'models') {
  models(scenario);
} else {
  await run(scenario);
}
