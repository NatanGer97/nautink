import { chatRequestSchema } from '@nautink/contracts/chat';

import { buildClaudeArgs } from './claude-args.ts';
import { startClaudeRun } from './claude-run.ts';
import { openEventStream } from './event-stream.ts';
import { BAD_REQUEST, describeIssues, sendError } from './http-errors.ts';
import { buildPrompt } from './prompt.ts';

import type { ClaudeRun } from './claude-run.ts';
import type { EventStream } from './event-stream.ts';
import type { RepoSelection } from './repo-selection.ts';
import type { ChatRequest } from '@nautink/contracts/chat';
import type { Request, RequestHandler, Response } from 'express';
import type { z } from 'zod';

export interface ChatRouteOptions {
  claudeBin: string;
  repoSelection: RepoSelection;
  /** The CLI's working directory when no codebase is selected. */
  workDir: string;
}

function startRun(options: ChatRouteOptions, request: ChatRequest, stream: EventStream): ClaudeRun {
  const repoDir: string | null = options.repoSelection.get();
  return startClaudeRun({
    bin: options.claudeBin,
    args: buildClaudeArgs({ ...request, isRepoAware: repoDir !== null }),
    cwd: repoDir ?? options.workDir,
    prompt: buildPrompt(request),
    emit: stream.send,
    onEnd: stream.end,
  });
}

/** `POST /api/chat`: one `claude -p` run streamed back as SSE (PRD §7.4). */
export function createChatHandler(options: ChatRouteOptions): RequestHandler {
  return (req: Request, res: Response): void => {
    const parsed: z.ZodSafeParseResult<ChatRequest> = chatRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, BAD_REQUEST, describeIssues(parsed.error));
      return;
    }
    const run: ClaudeRun = startRun(options, parsed.data, openEventStream(res));
    // The client went away (stop button, closed tab): kill the run.
    res.on('close', () => {
      run.stop();
    });
  };
}
