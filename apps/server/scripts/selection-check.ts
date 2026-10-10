// PRD §4.1 "done when": sends the ten scripted prompts with a selection to a running Nautink server
// (which runs the local Claude Code CLI), and checks with Mermaid's parser that each reply changed
// only the selected nodes and their direct links. Not part of `pnpm check`: it calls real Claude.
//
//   pnpm --filter @nautink/server start                  # in one terminal
//   node apps/server/scripts/selection-check.ts [--url http://127.0.0.1:8791] [--model sonnet]
import { modelIdSchema } from '@nautink/contracts/models';
import { API_ROUTES } from '@nautink/contracts/routes';
import { createChatStreamDecoder } from '@nautink/contracts/sse';
import process from 'node:process';
import { parseArgs } from 'node:util';

import { parseFlow } from './flow-parser.ts';
import { SELECTION_CASES } from './selection-cases.ts';
import { scopeViolations } from './selection-scope.ts';

import type { SelectionCase } from './selection-cases.ts';
import type { ChatEvent, ChatRequest, ChatSelection } from '@nautink/contracts/chat';
import type { ModelId } from '@nautink/contracts/models';
import type { ChatStreamDecoder } from '@nautink/contracts/sse';
import type { FlowGraph } from '@nautink/editors/flow/model';

/** PRD §4.1: at least 9 of the 10 prompts stay inside the selection. */
const PASS_MARK: number = 9;
const DEFAULT_URL: string = 'http://127.0.0.1:8791';
const MERMAID_BLOCK: RegExp = /```mermaid\s*\n([\s\S]*?)```/;

interface CheckOptions {
  url: string;
  model: ModelId | null;
}

interface CaseResult {
  isInScope: boolean;
  detail: string;
}

function readOptions(): CheckOptions {
  const { values } = parseArgs({
    options: { url: { type: 'string', default: DEFAULT_URL }, model: { type: 'string' } },
  });
  return { url: values.url, model: modelIdSchema.nullable().parse(values.model ?? null) };
}

/** The selection as the web app sends it: Mermaid ids, their labels, kind `node`. */
function selectionOf(graph: FlowGraph, ids: readonly string[]): ChatSelection {
  const labels: string[] = ids.map((id) => {
    const label: string | undefined = graph.nodes.find((node) => node.id === id)?.label;
    if (label === undefined) {
      throw new Error(`The case selects "${id}", which is not a node of its diagram.`);
    }
    return label;
  });
  return { ids: [...ids], labels, kinds: ids.map(() => 'node') };
}

/** The reply's text once the stream ends, from `done` (or the deltas if `done` has none). */
function replyText(events: readonly ChatEvent[]): string {
  const failure: ChatEvent | undefined = events.find((event) => event.type === 'error');
  if (failure?.type === 'error') {
    throw new Error(`Claude failed: ${failure.message}`);
  }
  const done: ChatEvent | undefined = events.find((event) => event.type === 'done');
  const deltas: string = events.map((event) => (event.type === 'delta' ? event.text : '')).join('');
  return done?.type === 'done' && done.text !== '' ? done.text : deltas;
}

/** The whole SSE body at once: the check needs the finished reply, not the live stream. */
async function readEvents(response: Response): Promise<ChatEvent[]> {
  const body: string = await response.text();
  if (!response.ok) {
    throw new Error(`The server answered ${String(response.status)}: ${body}`);
  }
  const decoder: ChatStreamDecoder = createChatStreamDecoder();
  return decoder.push(`${body}\n\n`);
}

/** One fresh Claude turn: the check never resumes a session. */
async function ask(
  options: CheckOptions,
  request: Pick<ChatRequest, 'message' | 'code' | 'model' | 'selection'>,
): Promise<string> {
  const body: ChatRequest = { ...request, sessionId: null, agent: 'claude' };
  const response: Response = await fetch(`${options.url}${API_ROUTES.chat}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return replyText(await readEvents(response));
}

async function judge(options: CheckOptions, scripted: SelectionCase): Promise<CaseResult> {
  const before: FlowGraph = await parseFlow(scripted.code);
  const reply: string = await ask(options, {
    message: scripted.message,
    code: scripted.code,
    model: options.model,
    selection: selectionOf(before, scripted.selected),
  });
  const code: string | undefined = MERMAID_BLOCK.exec(reply)?.[1];
  if (code === undefined) {
    return { isInScope: false, detail: 'no mermaid block in the reply' };
  }
  const violations: string[] = scopeViolations({
    before,
    after: await parseFlow(code),
    selected: scripted.selected,
  });
  return { isInScope: violations.length === 0, detail: violations.join('; ') };
}

async function runCase(options: CheckOptions, scripted: SelectionCase): Promise<boolean> {
  let result: CaseResult;
  try {
    result = await judge(options, scripted);
  } catch (err) {
    result = { isInScope: false, detail: err instanceof Error ? err.message : String(err) };
  }
  const verdict: string = result.isInScope ? 'PASS' : 'FAIL';
  const detail: string = result.detail === '' ? '' : ` — ${result.detail}`;
  process.stdout.write(`${verdict}  ${scripted.name}${detail}\n`);
  return result.isInScope;
}

async function main(): Promise<void> {
  const options: CheckOptions = readOptions();
  let passed: number = 0;
  for (const scripted of SELECTION_CASES) {
    passed += (await runCase(options, scripted)) ? 1 : 0;
  }
  const total: string = String(SELECTION_CASES.length);
  process.stdout.write(`\nScore: ${String(passed)}/${total} (pass mark ${String(PASS_MARK)})\n`);
  process.exitCode = passed >= PASS_MARK ? 0 : 1;
}

await main();
