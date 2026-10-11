import type { ErrorResponse } from '@nautink/contracts/server-info';
import type { Response } from 'express';
import type { z } from 'zod';

export const BAD_REQUEST: number = 400;
export const FORBIDDEN: number = 403;
export const NOT_FOUND: number = 404;

/** Every 4xx/5xx answer is JSON `{ error }`, so the web app can show the message. */
export function sendError(res: Response, status: number, message: string): void {
  const body: ErrorResponse = { error: message };
  res.status(status).json(body);
}

/** `message: message is required; model: Invalid option…` — one line naming each bad field. */
export function describeIssues(error: z.ZodError): string {
  const issues: string[] = error.issues.map((issue: z.core.$ZodIssue) => {
    const field: string = issue.path.map(String).join('.');
    return field === '' ? issue.message : `${field}: ${issue.message}`;
  });
  return `Invalid request body: ${issues.join('; ')}`;
}
