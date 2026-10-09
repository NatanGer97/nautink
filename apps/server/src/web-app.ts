import express from 'express';
import { existsSync } from 'node:fs';
import path from 'node:path';

import type { Express, NextFunction, Request, Response } from 'express';

const API_PATH: RegExp = /^\/api(\/|$)/;

/** The built web app to serve, or `null`: only in production, and only once `apps/web` is built. */
export function findWebDist(repoRoot: string, isProduction: boolean): string | null {
  const distDir: string = path.join(repoRoot, 'apps', 'web', 'dist');
  return isProduction && existsSync(distDir) ? distDir : null;
}

/** Serves the built app, and its `index.html` for every other non-API GET (client-side routes). */
export function serveWebApp(app: Express, distDir: string): void {
  app.use(express.static(distDir));
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET' || API_PATH.test(req.path)) {
      next();
      return;
    }
    res.sendFile(path.join(distDir, 'index.html'));
  });
}
