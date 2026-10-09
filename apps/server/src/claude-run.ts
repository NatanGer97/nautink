import { spawn } from 'node:child_process';
import process from 'node:process';

import { createLineSplitter, lineToChatEvents } from './stream-json.ts';

import type { LineSplitter } from './stream-json.ts';
import type { ChatEvent } from '@nautink/contracts/chat';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';

export interface ClaudeRunOptions {
  bin: string;
  args: string[];
  cwd: string;
  prompt: string;
  /** Receives every event of the run, ending with exactly one `done` or `error`, then `onEnd`. */
  emit: (event: ChatEvent) => void;
  onEnd: () => void;
}

/** A running `claude -p`. `stop` kills it, for when the client goes away. */
export interface ClaudeRun {
  stop: () => void;
}

function describeExit(stderr: string, code: number | null, signal: string | null): string {
  if (stderr.trim() !== '') {
    return stderr.trim();
  }
  return code === null
    ? `claude was stopped by ${String(signal)}`
    : `claude exited with code ${String(code)}`;
}

/** Follows one run's output and makes sure it ends exactly once, with `done` or an `error`. */
class RunTracker {
  private stderr: string = '';
  private hasResult: boolean = false;
  private hasEnded: boolean = false;
  private readonly splitter: LineSplitter = createLineSplitter();
  private readonly options: ClaudeRunOptions;

  constructor(options: ClaudeRunOptions) {
    this.options = options;
  }

  readOutput(chunk: string): void {
    for (const event of this.splitter.push(chunk).flatMap(lineToChatEvents)) {
      this.hasResult ||= event.type === 'done';
      this.options.emit(event);
    }
  }

  readError(chunk: string): void {
    this.stderr += chunk;
  }

  failToStart(err: Error): void {
    this.end(`Failed to start "${this.options.bin}": ${err.message}`);
  }

  exit(code: number | null, signal: string | null): void {
    this.end(this.hasResult ? null : describeExit(this.stderr, code, signal));
  }

  private end(failure: string | null): void {
    if (this.hasEnded) {
      return;
    }
    this.hasEnded = true;
    if (failure !== null) {
      this.options.emit({ type: 'error', message: failure });
    }
    this.options.onEnd();
  }
}

function watchChild(child: ChildProcessWithoutNullStreams, options: ClaudeRunOptions): void {
  const tracker: RunTracker = new RunTracker(options);
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk: string) => {
    tracker.readOutput(chunk);
  });
  child.stderr.on('data', (chunk: string) => {
    tracker.readError(chunk);
  });
  child.on('error', (err: Error) => {
    tracker.failToStart(err);
  });
  child.on('close', (code: number | null, signal: string | null) => {
    tracker.exit(code, signal);
  });
}

function isRunning(child: ChildProcessWithoutNullStreams): boolean {
  return child.exitCode === null && child.signalCode === null;
}

/** Spawns the CLI without a shell, pipes the prompt to stdin and streams its events (v1's bridge). */
export function startClaudeRun(options: ClaudeRunOptions): ClaudeRun {
  const child: ChildProcessWithoutNullStreams = spawn(options.bin, options.args, {
    cwd: options.cwd,
    env: process.env,
    stdio: 'pipe',
  });
  watchChild(child, options);
  // A CLI that exits before reading its prompt breaks the pipe; the exit itself is what gets reported.
  child.stdin.on('error', () => undefined);
  child.stdin.end(options.prompt);
  return {
    stop(): void {
      if (isRunning(child)) {
        child.kill('SIGTERM');
      }
    },
  };
}
