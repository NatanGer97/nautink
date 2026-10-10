import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

import { DEFAULT_CLAUDE_BIN, DEFAULT_CODEX_BIN, DEFAULT_PORT, loadConfig } from './config.ts';
import { makeTempDir } from '../tests/test-server.ts';

let home: string;

beforeAll(async () => {
  home = await makeTempDir('config-home');
  await mkdir(path.join(home, 'app'));
  await writeFile(path.join(home, 'notes.txt'), 'x');
});

describe('loadConfig', () => {
  it('uses the defaults when nothing is set', () => {
    expect(loadConfig({}, home)).toEqual({
      port: DEFAULT_PORT,
      claudeBin: DEFAULT_CLAUDE_BIN,
      codexBin: DEFAULT_CODEX_BIN,
      repoDir: null,
      isProduction: false,
    });
    expect(DEFAULT_PORT).toBe(8791);
    expect(DEFAULT_CODEX_BIN).toBe('codex');
  });

  it('reads every variable', () => {
    const env = {
      API_PORT: '9000',
      CLAUDE_BIN: '/opt/claude',
      CODEX_BIN: '/opt/codex',
      REPO_DIR: '~/app',
      NODE_ENV: 'production',
    };
    expect(loadConfig(env, home)).toEqual({
      port: 9000,
      claudeBin: '/opt/claude',
      codexBin: '/opt/codex',
      repoDir: path.join(home, 'app'),
      isProduction: true,
    });
  });

  it('lists every invalid variable in one error', () => {
    const env = {
      API_PORT: '80a',
      CLAUDE_BIN: '',
      CODEX_BIN: '',
      REPO_DIR: path.join(home, 'missing'),
    };
    expect(() => loadConfig(env, home)).toThrow(
      `Invalid server configuration:\n  - API_PORT must be a whole number\n  - CLAUDE_BIN must not be empty\n  - CODEX_BIN must not be empty\n  - REPO_DIR does not exist: ${path.join(home, 'missing')}`,
    );
  });

  it('rejects an out-of-range port, an empty one and a REPO_DIR that is a file', () => {
    expect(() => loadConfig({ API_PORT: '70000' }, home)).toThrow('API_PORT must be at most 65535');
    expect(() => loadConfig({ API_PORT: '' }, home)).toThrow('API_PORT must be a whole number');
    expect(() => loadConfig({ REPO_DIR: '' }, home)).toThrow('REPO_DIR must not be empty');
    expect(() => loadConfig({ REPO_DIR: path.join(home, 'notes.txt') }, home)).toThrow(
      'REPO_DIR is not a folder',
    );
  });
});
