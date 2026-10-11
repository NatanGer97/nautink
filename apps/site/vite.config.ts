import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

import type { Plugin } from 'vite';

const DOCS_DIR: string = fileURLToPath(new URL('../../docs/', import.meta.url));

// The page links the README screenshots and the brand files in `docs/` directly, so they stay one
// copy. The build bundles them from there, but the dev server only serves its own folder, so in dev
// those links go through Vite's `/@fs/` route, which allows any file in the workspace.
function serveDocsInDev(): Plugin {
  return {
    name: 'nautink-site-docs-in-dev',
    apply: 'serve',
    transformIndexHtml: (html) => html.replaceAll('../../docs/', `/@fs${DOCS_DIR}`),
  };
}

export default defineConfig({
  // Relative asset URLs, so the build works from any path (GitHub Pages serves it under /nautink/).
  base: './',
  plugins: [serveDocsInDev()],
  server: {
    port: 5191,
    strictPort: true,
  },
});
