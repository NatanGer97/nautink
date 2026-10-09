import express from 'express';

import { sendError } from './http-errors.ts';

import type { NextFunction, Request, RequestHandler, Response } from 'express';

const MAX_BODY_SIZE: string = '2mb';

/** What `express.json` passes to `next` on failure: an http-errors error with a 4xx status. */
interface BodyParserError {
  status: number;
  message: string;
}

const jsonParser: RequestHandler = express.json({ limit: MAX_BODY_SIZE });

/** `express.json`, but a malformed or oversized body gets a JSON error instead of an HTML page. */
export function parseJsonBody(req: Request, res: Response, next: NextFunction): void {
  void jsonParser(req, res, (err?: unknown) => {
    if (err === undefined) {
      next();
      return;
    }
    const failure: BodyParserError = err as BodyParserError;
    sendError(res, failure.status, `Invalid request body: ${failure.message}`);
  });
}
