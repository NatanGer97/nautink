import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// monaco-editor's "exports" map serves `./*` as `./esm/vs/*.js`, which breaks its two CSS files
// (`src/code/monaco-core.ts`). This sends those imports straight to the files.
const MONACO_ESM: string = fileURLToPath(
  new URL('./node_modules/monaco-editor/esm/vs/', import.meta.url),
);

// Ports are the repo's app defaults (docs/conventions.md): the web app on 5190, the API server on
// 8791, reached through the dev proxy so the browser only ever talks to one origin.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [{ find: /^monaco-editor\/(.+\.css)$/, replacement: `${MONACO_ESM}$1` }],
  },
  // Scan every source file at startup, not only what the first page loads. Otherwise Vite finds the
  // lazy chunks' dependencies (Monaco, React Flow, dagre) on first use, re-bundles and reloads the
  // page, which made e2e tests fail at random on a cold server.
  optimizeDeps: {
    entries: ['index.html', 'src/**/*.{ts,tsx}', '!src/**/*.test.{ts,tsx}'],
  },
  server: {
    port: 5190,
    strictPort: true,
    proxy: { '/api': 'http://127.0.0.1:8791' },
  },
});
