#!/usr/bin/env node
/**
 * A stand-in for the Claude Code CLI, run by the tests through `CLAUDE_BIN`. It prints
 * `--output-format stream-json` lines for the scenario named in `FAKE_CLAUDE_SCENARIO`, and when
 * `FAKE_CLAUDE_RECORD` names a file it writes its argv, cwd, stdin and pid there first.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import process from 'node:process';
import { setTimeout as sleep } from 'node:timers/promises';

const SESSION_ID = 'fake-session-1';
const HANG_MS = 60_000;

type Line = Record<string, unknown>;

const init: Line = { type: 'system', subtype: 'init', session_id: SESSION_ID, model: 'fake-model' };
const messageStart: Line = { type: 'stream_event', event: { type: 'message_start' } };

function textDelta(text: string, parentToolUseId: string | null = null): Line {
  return {
    type: 'stream_event',
    parent_tool_use_id: parentToolUseId,
    event: { type: 'content_block_delta', delta: { type: 'text_delta', text } },
  };
}

function result(text: string, isError = false): Line {
  return {
    type: 'result',
    session_id: SESSION_ID,
    result: text,
    is_error: isError,
    duration_ms: 42,
    total_cost_usd: 0.01,
  };
}

function toolUse(name: string, input: Record<string, unknown>): Line {
  return { type: 'tool_use', id: `tool-${name}`, name, input };
}

const SCENARIOS: Record<string, Line[]> = {
  reply: [
    init,
    messageStart,
    textDelta('Here is '),
    textDelta('ignored sub-agent text', 'tool-1'),
    textDelta('the diagram.'),
    {
      type: 'stream_event',
      event: { type: 'content_block_delta', delta: { type: 'input_json_delta' } },
    },
    { type: 'assistant', message: { content: [{ type: 'text', text: 'Here is the diagram.' }] } },
    { type: 'user', message: { content: [] } },
    result('Here is the diagram.'),
  ],
  tool: [
    init,
    messageStart,
    {
      type: 'assistant',
      message: {
        content: [
          { type: 'text', text: 'Looking.' },
          toolUse('Read', { file_path: 'src/auth.ts' }),
          toolUse('Grep', { pattern: 'login', path: 'src' }),
          toolUse('Glob', {}),
        ],
      },
    },
    messageStart,
    textDelta('Done.'),
    result('Done.'),
  ],
  'error-result': [init, result('The model is overloaded.', true)],
};

function write(line: Line | string): void {
  process.stdout.write(`${typeof line === 'string' ? line : JSON.stringify(line)}\n`);
}

function record(): void {
  const recordPath = process.env.FAKE_CLAUDE_RECORD;
  if (recordPath === undefined) {
    return;
  }
  const stdin = process.argv.includes('--version') ? '' : readFileSync(0, 'utf8');
  const argv = process.argv.slice(2);
  writeFileSync(recordPath, JSON.stringify({ argv, cwd: process.cwd(), stdin, pid: process.pid }));
}

async function partial(): Promise<void> {
  const line = JSON.stringify(textDelta('split across chunks'));
  write(init);
  process.stdout.write(line.slice(0, 20));
  await sleep(30);
  process.stdout.write(`${line.slice(20)}\nnot json at all\n\n`);
  await sleep(30);
  write(result('split across chunks'));
}

async function version(scenario: string): Promise<void> {
  if (scenario === 'version-fail') {
    process.stderr.write('version check exploded\n');
    process.exit(2);
  }
  if (scenario === 'hang') {
    await sleep(HANG_MS);
  }
  write('2.1.0 (Claude Code)');
}

async function run(scenario: string): Promise<void> {
  if (scenario === 'partial') {
    await partial();
  } else if (scenario === 'crash') {
    process.stderr.write('Invalid API key · Please run /login\n');
    process.exit(1);
  } else if (scenario === 'silent-exit') {
    process.exit(3);
  } else if (scenario === 'hang') {
    write(init);
    await sleep(HANG_MS);
  } else {
    for (const line of SCENARIOS[scenario] ?? SCENARIOS.reply!) {
      write(line);
    }
  }
}

const scenario = process.env.FAKE_CLAUDE_SCENARIO ?? 'reply';
record();
await (process.argv.includes('--version') ? version(scenario) : run(scenario));
