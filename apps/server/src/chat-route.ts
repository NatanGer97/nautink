import { chatRequestSchema } from '@nautink/contracts/chat';

import { buildClaudeArgs } from './claude-args.ts';
import { startCliRun } from './cli-run.ts';
import { buildCodexArgs } from './codex-args.ts';
import { createCodexParser } from './codex-json.ts';
import { openEventStream } from './event-stream.ts';
import { BAD_REQUEST, describeIssues, sendError } from './http-errors.ts';
import { buildPrompt } from './prompt.ts';
import { lineToChatEvents } from './stream-json.ts';

import type { CliRun } from './cli-run.ts';
import type { EventStream } from './event-stream.ts';
import type { RepoSelection } from './repo-selection.ts';
import type { AgentId } from '@nautink/contracts/agents';
import type { ChatEvent, ChatRequest } from '@nautink/contracts/chat';
import type { Request, RequestHandler, Response } from 'express';
import type { z } from 'zod';

export interface ChatRouteOptions {
  claudeBin: string;
  codexBin: string;
  repoSelection: RepoSelection;
  /** The CLI's working directory when no codebase is selected. */
  workDir: string;
}

/** How to run one agent's CLI: its command, its arguments and how to read its output. */
interface AgentCommand {
  bin: string;
  args: string[];
  parseLine: (line: string) => ChatEvent[];
}

function agentCommand(
  options: ChatRouteOptions,
  request: ChatRequest,
  isRepoAware: boolean,
): AgentCommand {
  const commands: Record<AgentId, () => AgentCommand> = {
    claude: () => ({
      bin: options.claudeBin,
      args: buildClaudeArgs({ ...request, isRepoAware }),
      parseLine: lineToChatEvents,
    }),
    codex: () => ({
      bin: options.codexBin,
      args: buildCodexArgs({ ...request, isRepoAware }),
      parseLine: createCodexParser({ model: request.model, now: Date.now }).parseLine,
    }),
  };
  return commands[request.agent]();
}

function startRun(options: ChatRouteOptions, request: ChatRequest, stream: EventStream): CliRun {
  const repoDir: string | null = options.repoSelection.get();
  return startCliRun({
    ...agentCommand(options, request, repoDir !== null),
    name: request.agent,
    cwd: repoDir ?? options.workDir,
    prompt: buildPrompt(request),
    emit: stream.send,
    onEnd: stream.end,
  });
}

/** `POST /api/chat`: one `claude -p` or `codex exec` run streamed back as SSE (PRD §7.4, ADR-002). */
export function createChatHandler(options: ChatRouteOptions): RequestHandler {
  return (req: Request, res: Response): void => {
    const parsed: z.ZodSafeParseResult<ChatRequest> = chatRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, BAD_REQUEST, describeIssues(parsed.error));
      return;
    }
    const run: CliRun = startRun(options, parsed.data, openEventStream(res));
    // The client went away (stop button, closed tab): kill the run.
    res.on('close', () => {
      run.stop();
    });
  };
}
