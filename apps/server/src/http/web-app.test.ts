import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { findWebDist } from './web-app.ts';
import { makeTempDir, postJson, startTestServer } from '../../tests/test-server.ts';

import type { TestServer } from '../../tests/test-server.ts';

let root: string;
let distDir: string;
let server: TestServer | undefined;

beforeAll(async () => {
  root = await makeTempDir('web-root');
  distDir = path.join(root, 'apps', 'web', 'dist');
  await mkdir(path.join(distDir, 'assets'), { recursive: true });
  await writeFile(path.join(distDir, 'index.html'), '<title>Nautink</title>');
  await writeFile(path.join(distDir, 'assets', 'app.js'), 'export {};');
});

afterEach(async () => {
  await server?.close();
  server = undefined;
});

describe('findWebDist', () => {
  it('serves apps/web/dist only in production and only when it exists', async () => {
    expect(findWebDist(root, true)).toBe(distDir);
    expect(findWebDist(root, false)).toBeNull();
    expect(findWebDist(await makeTempDir('empty-root'), true)).toBeNull();
  });
});

describe('serving the built web app', () => {
  it('serves files, falls back to index.html for app routes, and keeps /api as JSON', async () => {
    server = await startTestServer({ webDistDir: distDir });
    const asset = await fetch(`${server.url}/assets/app.js`);
    expect(await asset.text()).toBe('export {};');
    const route = await fetch(`${server.url}/diagrams/42`);
    expect(route.status).toBe(200);
    expect(await route.text()).toBe('<title>Nautink</title>');
    const api = await fetch(`${server.url}/api/missing`);
    expect(api.status).toBe(404);
    expect(await api.json()).toEqual({ error: 'Not found: GET /api/missing' });
    const post = await postJson(`${server.url}/diagrams`, {});
    expect(post.status).toBe(404);
  });

  it('serves no web app when no dist dir is given', async () => {
    server = await startTestServer();
    expect((await fetch(`${server.url}/`)).status).toBe(404);
  });
});
