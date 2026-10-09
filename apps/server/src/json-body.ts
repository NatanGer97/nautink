import express from 'express';

import { BAD_REQUEST, sendError } from './http-errors.ts';

import type { NextFunction, Request, RequestHandler, Response } from 'express';

const MAX_BODY_SIZE: string = '2mb';

function statusOf(err: unknown): number {
  const status: unknown =
    typeof err === 'object' && err !== null && 'status' in err ? err.status : null;
  return typeof status === 'number' ? status : BAD_REQUEST;
}

const jsonParser: RequestHandler = express.json({ limit: MAX_BODY_SIZE });

/** `express.json`, but a malformed or oversized body gets a JSON error instead of an HTML page. */
export function parseJsonBody(req: Request, res: Response, next: NextFunction): void {
  void jsonParser(req, res, (err?: unknown) => {
    if (err === undefined || err === null) {
      next();
      return;
    }
    const reason: string = err instanceof Error ? err.message : 'unreadable body';
    sendError(res, statusOf(err), `Invalid request body: ${reason}`);
  });
}
