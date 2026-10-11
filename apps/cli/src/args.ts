import { parseArgs } from 'node:util';

import type { ParseArgsOptionsConfig } from 'node:util';

/** What one `nautink` invocation asks for. `port: null` leaves the port to the server (`API_PORT`, 8791). */
export type CliCommand =
  | { kind: 'run'; port: number | null; shouldOpen: boolean }
  | { kind: 'help' }
  | { kind: 'version' };

type Token = NonNullable<ReturnType<typeof parseArgs>['tokens']>[number];
type OptionToken = Extract<Token, { kind: 'option' }>;

const MAX_PORT: number = 65_535;
const HINT: string = 'Run nautink --help to see the options.';

const OPTIONS: ParseArgsOptionsConfig = {
  port: { type: 'string' },
  open: { type: 'boolean' },
  'no-open': { type: 'boolean' },
  help: { type: 'boolean', short: 'h' },
  version: { type: 'boolean', short: 'v' },
};

export const HELP_TEXT: string = `Usage: nautink [options]

Starts Nautink on http://127.0.0.1 and opens it in your browser.

Options:
  --port <number>  Port to listen on (default: API_PORT, or 8791)
  --no-open        Do not open the browser
  -h, --help       Show this help
  -v, --version    Show the version

Environment: API_PORT, CLAUDE_BIN, CODEX_BIN, REPO_DIR (see the README).`;

function toPort(value: string | undefined): number {
  if (value === undefined) {
    throw new Error(`Option '--port' needs a value. ${HINT}`);
  }
  if (!/^\d+$/.test(value) || Number(value) > MAX_PORT) {
    throw new Error(`--port must be a whole number from 0 to ${String(MAX_PORT)}, got '${value}'.`);
  }
  return Number(value);
}

function checkToken(token: Token): void {
  if (token.kind === 'positional') {
    throw new Error(`Unexpected argument '${token.value}'. ${HINT}`);
  }
  if (token.kind === 'option' && !Object.hasOwn(OPTIONS, token.name)) {
    throw new Error(`Unknown option '${token.rawName}'. ${HINT}`);
  }
}

function readRun(options: OptionToken[]): CliCommand {
  let port: number | null = null;
  let shouldOpen: boolean = true;
  for (const option of options) {
    if (option.name === 'port') {
      port = toPort(option.value);
    } else {
      shouldOpen = option.name === 'open';
    }
  }
  return { kind: 'run', port, shouldOpen };
}

/** Reads the command line. Throws one clear error for anything it does not understand. */
export function parseCliArgs(argv: readonly string[]): CliCommand {
  const { tokens } = parseArgs({ args: [...argv], options: OPTIONS, strict: false, tokens: true });
  tokens.forEach(checkToken);
  const options: OptionToken[] = tokens.filter((token: Token) => token.kind === 'option');
  if (options.some((option: OptionToken) => option.name === 'help')) {
    return { kind: 'help' };
  }
  if (options.some((option: OptionToken) => option.name === 'version')) {
    return { kind: 'version' };
  }
  return readRun(options);
}
