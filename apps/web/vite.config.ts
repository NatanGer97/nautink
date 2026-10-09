import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Ports are the repo's app defaults (docs/conventions.md): the web app on 5190, the API server on
// 8791, reached through the dev proxy so the browser only ever talks to one origin.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5190,
    strictPort: true,
    proxy: { '/api': 'http://127.0.0.1:8791' },
  },
});
