import { listVersions } from '@nautink/storage/versions';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetChatState, useChatStore } from './chat-store.ts';
import { askClaudeToFix, canSendChat, sendChat, startNewChat, stopChat } from './send-chat.ts';
import { VERSIONS_CHANGED_EVENT, beforeAgentLabel } from './turn-versions.ts';
import { controlledStream, eventsResponse, replyEvents } from '../../tests/chat-stream.ts';
import { loadedWorkspace } from '../../tests/workspace-fixtures.ts';
import { selectActiveDiagram, selectActiveStack } from '../workspace/use-workspace.ts';

import type { ChatDeps } from './chat-deps.ts';
import type { TestWorkspace } from '../../tests/workspace-fixtures.ts';
import type { MermaidError } from '../mermaid/validate.ts';
import type { AgentId } from '@nautink/contracts/agents';
import type { ChatEvent, ChatRequest } from '@nautink/contracts/chat';
import type { Diagram } from '@nautink/storage/records';
import type { Mock } from 'vitest';

const VALID = 'flowchart TD\n  A --> B';
const INVALID = 'flowchart TD\n  A -->';
const FIXED = 'flowchart TD\n  A --> C';

function fenced(code: string, prose = 'Here it is.'): string {
  return `${prose}\n\`\`\`mermaid\n${code}\n\`\`\``;
}

interface Harness {
  workspace: TestWorkspace;
  deps: ChatDeps;
  fetchImpl: Mock<ChatDeps['fetchImpl']>;
  notifyError: Mock<ChatDeps['notifyError']>;
  requests: () => ChatRequest[];
  active: () => Diagram;
}

async function harness(
  responses: ((init?: RequestInit) => Response)[],
  agent: AgentId = 'claude',
): Promise<Harness> {
  const workspace = await loadedWorkspace();
  const queue = [...responses];
  const fetchImpl = vi.fn<ChatDeps['fetchImpl']>(async (...[, init]) => {
    const next = queue.shift();
    if (next === undefined) {
      throw new Error('No more canned replies.');
    }
    return Promise.resolve(next(init));
  });
  const notifyError = vi.fn<ChatDeps['notifyError']>();
  const deps: ChatDeps = {
    fetchImpl,
    validate: async (code: string): Promise<MermaidError | null> =>
      Promise.resolve(code === INVALID ? { message: 'Parse error on line 2', line: 2 } : null),
    workspace: workspace.store.getState,
    agent: () => agent,
    model: () => (agent === 'claude' ? 'sonnet' : null),
    isChatOpen: () => false,
    notifyError,
    // These tests cover the turn as it applies straight away; `review/` covers review on.
    shouldReview: () => false,
    review: async () => Promise.reject(new Error('Review is off in these tests.')),
  };
  return {
    workspace,
    deps,
    fetchImpl,
    notifyError,
    requests: () =>
      fetchImpl.mock.calls.map(([, init]) => JSON.parse(init?.body as string) as ChatRequest),
    active: () => selectActiveDiagram(workspace.store.getState())!,
  };
}

function reply(text: string): (init?: RequestInit) => Response {
  return () => eventsResponse(replyEvents(text));
}

afterEach(() => {
  resetChatState();
});

/** A Codex reply: whole text, no cost. */
function codexReply(text: string, sessionId = 'thread-1'): (init?: RequestInit) => Response {
  const events: ChatEvent[] = [
    { type: 'session', sessionId, model: 'default' },
    { type: 'delta', text },
    { type: 'done', sessionId, text, isError: false, durationMs: 900, costUsd: null },
  ];
  return () => eventsResponse(events);
}

describe('sendChat with an agent', () => {
  it('asks the chosen agent and records it on the reply, the session and the version', async () => {
    const h = await harness([codexReply(fenced(VALID))], 'codex');
    await sendChat('Draw A to B', {}, h.deps);
    expect(h.requests()[0]).toMatchObject({ agent: 'codex', model: null, sessionId: null });
    expect(h.active()).toMatchObject({ sessionId: 'thread-1', sessionAgent: 'codex' });
    expect(h.active().messages[1]).toMatchObject({
      role: 'assistant',
      agent: 'codex',
      meta: { durationMs: 900, costUsd: null },
    });
    const versions = await listVersions(h.workspace.store.getState().requireDb(), h.active().id);
    expect(versions.find((version) => version.kind === 'claude')?.agent).toBe('codex');
  });

  it('names the snapshot before the first change after the agent', () => {
    expect(beforeAgentLabel('codex')).toBe('Before Codex');
    expect(beforeAgentLabel('claude')).toBe('Before Claude');
  });

  it("starts a new session instead of sending another agent's session id", async () => {
    const h = await harness([codexReply(fenced(VALID), 'thread-2')], 'codex');
    h.workspace.store.getState().setSessionId(h.active().id, 'claude-session', 'claude');
    await sendChat('Draw A to B', {}, h.deps);
    expect(h.requests()[0]?.sessionId).toBeNull();
    expect(h.active()).toMatchObject({ sessionId: 'thread-2', sessionAgent: 'codex' });
  });

  it('resumes a session the same agent owns', async () => {
    const h = await harness([codexReply(fenced(VALID))], 'codex');
    h.workspace.store.getState().setSessionId(h.active().id, 'thread-1', 'codex');
    await sendChat('Draw A to B', {}, h.deps);
    expect(h.requests()[0]?.sessionId).toBe('thread-1');
  });

  it('treats a session saved before agents existed as Claude', async () => {
    const h = await harness([reply(fenced(VALID))]);
    // Saved before ADR-002: no `sessionAgent`.
    h.workspace.store.getState().setSessionId(h.active().id, 'old-session');
    await sendChat('Draw A to B', {}, h.deps);
    expect(h.requests()[0]).toMatchObject({ agent: 'claude', sessionId: 'old-session' });
  });
});

describe('sendChat', () => {
  it('streams the diagram in as one undo step, saves versions and keeps the session', async () => {
    const h = await harness([reply(fenced(VALID, 'I drew it.'))]);
    const before = h.active().code;
    const onVersions = vi.fn();
    window.addEventListener(VERSIONS_CHANGED_EVENT, onVersions);
    expect(await sendChat('Draw A to B', {}, h.deps)).toBe(true);
    window.removeEventListener(VERSIONS_CHANGED_EVENT, onVersions);
    expect(h.active().code).toBe(VALID);
    expect(h.active().sessionId).toBe('session-1');
    expect(h.active().messages).toEqual([
      { role: 'user', text: 'Draw A to B' },
      expect.objectContaining({ role: 'assistant', streaming: false, tools: [] }),
    ]);
    expect(h.requests()[0]).toEqual({
      message: 'Draw A to B',
      code: before,
      sessionId: null,
      agent: 'claude',
      model: 'sonnet',
      selection: null,
    });
    const stack = selectActiveStack(h.workspace.store.getState());
    expect(stack?.entries.map((entry) => entry.label)).toEqual([
      'New blank flowchart',
      'Claude: Draw A to B',
    ]);
    h.workspace.store.getState().undo();
    expect(h.active().code).toBe(before);
    const versions = await listVersions(h.workspace.db(), h.active().id);
    expect(versions.map((version) => [version.kind, version.label, version.prompt])).toEqual([
      ['claude', '', 'Draw A to B'],
      ['manual', 'Before Claude', ''],
    ]);
    expect(onVersions).toHaveBeenCalledOnce();
    expect(useChatStore.getState().announcement).toBe('Claude updated the diagram.');
  });

  it('resumes the session on the next message', async () => {
    const h = await harness([reply('Hello.'), reply('Again.')]);
    await sendChat('Hi', {}, h.deps);
    await sendChat('Hi again', {}, h.deps);
    expect(h.requests()[1]?.sessionId).toBe('session-1');
    expect(useChatStore.getState().announcement).toBe('Claude replied.');
  });

  it('retries an invalid diagram on its own, amending the same undo step', async () => {
    const h = await harness([reply(fenced(INVALID)), reply(fenced(FIXED, 'Fixed.'))]);
    const before = h.active().code;
    await sendChat('Draw it', { title: 'Add a node' }, h.deps);
    expect(h.requests()[1]?.message).toBe(
      'The diagram fails to parse:\nParse error on line 2\nFix it.',
    );
    expect(h.requests()[1]?.code).toBe(INVALID);
    expect(h.active().code).toBe(FIXED);
    expect(h.active().messages.map((message) => message.auto ?? false)).toEqual([
      false,
      false,
      true,
      false,
    ]);
    const stack = selectActiveStack(h.workspace.store.getState());
    expect(stack?.entries.map((entry) => entry.label)).toEqual([
      'New blank flowchart',
      'Claude: Add a node',
    ]);
    h.workspace.store.getState().undo();
    expect(h.active().code).toBe(before);
    expect(useChatStore.getState().replyEdits[h.active().id]).toEqual({
      1: stack?.entries[1]?.id,
      3: stack?.entries[1]?.id,
    });
  });

  it('stops after two retries and saves no version for a diagram that still fails', async () => {
    const h = await harness([
      reply(fenced(INVALID)),
      reply(fenced(INVALID)),
      reply(fenced(INVALID)),
    ]);
    await sendChat('Draw it', {}, h.deps);
    expect(h.fetchImpl).toHaveBeenCalledTimes(3);
    expect(h.active().code).toBe(INVALID);
    expect(await listVersions(h.workspace.db(), h.active().id)).toEqual([]);
    expect(useChatStore.getState().announcement).toMatch(/still has a syntax error/);
  });

  it('stops a streaming reply and puts the code back', async () => {
    const stream = controlledStream();
    const h = await harness([stream.response]);
    const before = h.active().code;
    const sending = sendChat('Draw it', {}, h.deps);
    await vi.waitFor(() => {
      expect(useChatStore.getState().busyDiagramId).toBe(h.active().id);
    });
    stream.send({ type: 'delta', text: '```mermaid\nflowchart LR\n  X --> Y' });
    await vi.waitFor(() => {
      expect(h.active().code).toBe('flowchart LR\n  X --> Y');
    });
    expect(canSendChat('another', h.deps)).toBe(false);
    stopChat();
    await sending;
    expect(h.active().code).toBe(before);
    expect(h.active().messages.at(-1)?.error).toBe('Stopped.');
    expect(selectActiveStack(h.workspace.store.getState())?.entries).toHaveLength(1);
    expect(useChatStore.getState()).toMatchObject({
      busyDiagramId: null,
      announcement: 'Claude stopped.',
    });
  });

  it('shows server errors in the chat, and as a notice when the chat is closed', async () => {
    const h = await harness([
      (): Response =>
        new Response(JSON.stringify({ error: 'claude was not found' }), { status: 500 }),
      (): Response => eventsResponse([{ type: 'error', message: 'Claude exited with code 1' }]),
    ]);
    await sendChat('Draw it', {}, h.deps);
    expect(h.active().messages.at(-1)).toMatchObject({
      streaming: false,
      error: 'claude was not found',
    });
    expect(h.notifyError).toHaveBeenCalledWith('Claude could not reply. claude was not found');
    await sendChat('Again', {}, { ...h.deps, isChatOpen: () => true });
    expect(h.active().messages.at(-1)?.error).toBe('Claude exited with code 1');
    expect(h.notifyError).toHaveBeenCalledOnce();
  });

  it('marks a reply that ends without a result as cut off', async () => {
    const h = await harness([(): Response => eventsResponse([{ type: 'delta', text: 'Partial' }])]);
    await sendChat('Draw it', {}, h.deps);
    expect(h.active().messages.at(-1)?.error).toMatch(/ended before Claude finished/);
  });

  it('records a new step when the user edits while Claude replies', async () => {
    const stream = controlledStream();
    const h = await harness([stream.response]);
    const sending = sendChat('Draw it', {}, h.deps);
    await vi.waitFor(() => {
      expect(h.fetchImpl).toHaveBeenCalled();
    });
    stream.send({ type: 'delta', text: '```mermaid\nflowchart LR\n  X' });
    await vi.waitFor(() => {
      expect(h.active().code).toBe('flowchart LR\n  X');
    });
    h.workspace.store
      .getState()
      .applyEdit('flowchart LR\n  typed', { label: 'Typed in code', source: 'code' });
    for (const event of [
      { type: 'delta', text: ' --> Y\n```' },
      { type: 'done', sessionId: 's', text: '', isError: false, durationMs: 1, costUsd: 0 },
    ] as const) {
      stream.send(event);
    }
    stream.end();
    await sending;
    const labels = selectActiveStack(h.workspace.store.getState())?.entries.map(
      (entry) => entry.label,
    );
    expect(labels).toEqual([
      'New blank flowchart',
      'Claude: Draw it',
      'Typed in code',
      'Claude: Draw it',
    ]);
    expect(h.active().code).toBe('flowchart LR\n  X --> Y');
  });
});

describe('askClaudeToFix, canSendChat and startNewChat', () => {
  it('sends the fix prompt as an automatic message labelled as a fix', async () => {
    const h = await harness([reply(fenced(FIXED))]);
    await askClaudeToFix('Bad arrow', h.deps);
    expect(h.active().messages[0]).toEqual({
      role: 'user',
      text: 'The diagram fails to parse:\nBad arrow\nFix it.',
      auto: true,
    });
    const stack = selectActiveStack(h.workspace.store.getState());
    expect(stack?.entries.at(-1)?.label).toBe('Claude: Fix syntax error');
  });

  it('refuses empty text', async () => {
    const h = await harness([]);
    expect(canSendChat('   ', h.deps)).toBe(false);
    expect(await sendChat('', {}, h.deps)).toBe(false);
    expect(h.fetchImpl).not.toHaveBeenCalled();
  });

  it('clears the messages and session, stopping the reply without a stray message', async () => {
    const stream = controlledStream();
    const h = await harness([reply('First.'), stream.response]);
    await sendChat('Hi', {}, h.deps);
    const sending = sendChat('Draw it', {}, h.deps);
    await vi.waitFor(() => {
      expect(h.fetchImpl).toHaveBeenCalledTimes(2);
    });
    startNewChat(h.active().id, h.deps);
    await sending;
    expect(h.active().messages).toEqual([]);
    expect(h.active().sessionId).toBeNull();
    expect(useChatStore.getState().replyEdits[h.active().id]).toEqual({});
  });
});
