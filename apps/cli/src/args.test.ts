import { describe, expect, it } from 'vitest';

import { parseCliArgs } from './args.ts';

describe('parseCliArgs', () => {
  it('runs on the server default port and opens the browser by default', () => {
    expect(parseCliArgs([])).toEqual({ kind: 'run', port: null, shouldOpen: true });
  });

  it('reads --port and --no-open', () => {
    expect(parseCliArgs(['--port', '9000', '--no-open'])).toEqual({
      kind: 'run',
      port: 9000,
      shouldOpen: false,
    });
    expect(parseCliArgs(['--port=0'])).toEqual({ kind: 'run', port: 0, shouldOpen: true });
  });

  it('reads --help and --version, with their short forms', () => {
    expect(parseCliArgs(['--help'])).toEqual({ kind: 'help' });
    expect(parseCliArgs(['-h'])).toEqual({ kind: 'help' });
    expect(parseCliArgs(['--version'])).toEqual({ kind: 'version' });
    expect(parseCliArgs(['-v'])).toEqual({ kind: 'version' });
  });

  it('refuses an unknown option or a stray argument', () => {
    expect(() => parseCliArgs(['--prot', '9000'])).toThrow(
      "Unknown option '--prot'. Run nautink --help to see the options.",
    );
    expect(() => parseCliArgs(['serve'])).toThrow(
      "Unexpected argument 'serve'. Run nautink --help to see the options.",
    );
  });

  it('refuses a port that is not a whole number from 0 to 65535', () => {
    for (const port of ['abc', '-1', '1.5', '65536', '']) {
      expect(() => parseCliArgs(['--port', port])).toThrow(
        `--port must be a whole number from 0 to 65535, got '${port}'.`,
      );
    }
  });

  it('refuses --port without a value', () => {
    expect(() => parseCliArgs(['--port'])).toThrow(
      "Option '--port' needs a value. Run nautink --help to see the options.",
    );
  });
});
