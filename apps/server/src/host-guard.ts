import { FORBIDDEN, sendError } from './http-errors.ts';

import type { NextFunction, Request, Response } from 'express';

/** Host names a browser uses to reach this server on the same machine. */
const ALLOWED_HOSTNAMES: ReadonlySet<string> = new Set(['localhost', '127.0.0.1', '[::1]']);

/** `localhost:8791` → `localhost`, `[::1]:8791` → `[::1]`. Lower-cased; `''` when missing. */
export function hostnameOf(hostHeader: string | undefined): string {
  const host: string = (hostHeader ?? '').trim().toLowerCase();
  if (host.startsWith('[')) {
    return host.slice(0, host.indexOf(']') + 1);
  }
  return host.split(':')[0] ?? '';
}

/**
 * Blocks DNS rebinding: a hostile site whose domain resolves to 127.0.0.1 would send its own domain
 * in the Host header. Only requests addressed to a local host name reach the API.
 */
export function guardHost(req: Request, res: Response, next: NextFunction): void {
  if (ALLOWED_HOSTNAMES.has(hostnameOf(req.headers.host))) {
    next();
    return;
  }
  sendError(res, FORBIDDEN, 'Requests must be addressed to localhost or 127.0.0.1.');
}
