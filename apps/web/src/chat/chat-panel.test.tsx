import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetChatState, useChatStore } from './chat-store.ts';
import { ASK_CLAUDE_TO_FIX_EVENT } from './use-chat-feature.ts';
import { controlledStream, eventsResponse, replyEvents } from '../../tests/chat-stream.ts';
import { App } from '../app.tsx';
import { loadMermaid } from '../mermaid/mermaid-instance.ts';
import { useUiStore } from '../state/ui-store.ts';
import { selectActiveDiagram, useWorkspaceStore } from '../workspace/use-workspace.ts';

import type { ChatRequest } from '@nautink/contracts/chat';
import type { Mock } from 'vitest';

type ChatReplier = (init?: RequestInit) => Response;

/** A turn ends after Mermaid checks the reply, which is slow under a loaded test run. */
const TURN_END = { timeout: 10_000 };

let replies: ChatReplier[] = [];

beforeAll(async () => {
  // Load Mermaid once up front, so no single test pays for its import.
  await loadMermaid();
}, 30_000);
let fetchMock: Mock<(input: string, init?: RequestInit) => Promise<Response>>;

beforeEach(() => {
  replies = [];
  fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
    const next = input === '/api/chat' ? replies.shift() : undefined;
    if (next === undefined) {
      return Promise.reject(new TypeError('Failed to fetch'));
    }
    return Promise.resolve(next(init));
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  resetChatState();
});

const VALID = 'flowchart TD\n  Start --> Done';

function fenced(code: string, prose = 'I drew it.'): string {
  return `${prose}\n\`\`\`mermaid\n${code}\n\`\`\``;
}

const code = (): string | undefined => selectActiveDiagram(useWorkspaceStore.getState())?.code;

function chatRequests(): ChatRequest[] {
  return fetchMock.mock.calls
    .filter(([input]) => input === '/api/chat')
    .map(([, init]) => JSON.parse(init?.body as string) as ChatRequest);
}

async function renderApp(): Promise<ReturnType<typeof userEvent.setup>> {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByLabelText('Diagram code');
  return user;
}

/** Types into the composer and sends with ⌘↵. Focused directly: jsdom panels have no size. */
async function sendFromComposer(
  user: ReturnType<typeof userEvent.setup>,
  text: string,
): Promise<void> {
  act(() => {
    screen.getByLabelText('Message Claude').focus();
  });
  await user.keyboard(text);
  await user.keyboard('{Meta>}{Enter}{/Meta}');
}

function chatPanel(): HTMLElement {
  return screen.getByRole('complementary', { name: 'Chat' });
}

describe('chat panel', () => {
  it('sends with ⌘↵, streams steps and text, and updates the diagram', async () => {
    const stream = controlledStream();
    replies.push(stream.response);
    const user = await renderApp();
    await sendFromComposer(user, 'Draw a start');
    expect(screen.getByLabelText<HTMLTextAreaElement>('Message Claude').value).toBe('');
    const panel = chatPanel();
    expect(await within(panel).findByText('Draw a start')).toBeTruthy();
    expect(within(panel).getByText('Thinking…')).toBeTruthy();
    expect(screen.getByText('Claude is replying.')).toBeTruthy();
    act(() => {
      stream.send({ type: 'session', sessionId: 's1', model: 'opus' });
      stream.send({ type: 'tool', label: 'Read src/app.ts' });
      stream.send({ type: 'delta', text: 'Working.\n```mermaid\nflowchart TD\n  Start' });
    });
    expect(await within(panel).findByText('Read src/app.ts')).toBeTruthy();
    expect(await within(panel).findByText('Writing diagram…')).toBeTruthy();
    await waitFor(() => {
      expect(code()).toBe('flowchart TD\n  Start');
    });
    act(() => {
      stream.send({ type: 'delta', text: ' --> Done\n```' });
      stream.send({
        type: 'done',
        sessionId: 's1',
        text: '',
        isError: false,
        durationMs: 6200,
        costUsd: 0,
      });
      stream.end();
    });
    expect(await within(panel).findByText('Diagram updated')).toBeTruthy();
    expect(within(panel).getByText('Claude · 6.2s')).toBeTruthy();
    expect(code()).toBe(VALID);
    expect(await screen.findByText('Claude updated the diagram.', {}, TURN_END)).toBeTruthy();
    expect(selectActiveDiagram(useWorkspaceStore.getState())?.sessionId).toBe('s1');
  });

  it('undoes the whole reply from its change card', async () => {
    replies.push(() => eventsResponse(replyEvents(fenced(VALID))));
    const user = await renderApp();
    const before = code();
    await sendFromComposer(user, 'Draw');
    const panel = chatPanel();
    await within(panel).findByText('Diagram updated');
    await user.click(within(panel).getByRole('button', { name: 'Undo' }));
    expect(code()).toBe(before);
    expect(within(panel).getByRole('button', { name: 'Undo' }).getAttribute('aria-disabled')).toBe(
      'true',
    );
  });

  it('stops a reply and shows that it stopped', async () => {
    const stream = controlledStream();
    replies.push(stream.response);
    const user = await renderApp();
    const before = code();
    await sendFromComposer(user, 'Draw');
    act(() => {
      stream.send({ type: 'delta', text: '```mermaid\nflowchart LR\n  X' });
    });
    await waitFor(() => {
      expect(code()).toBe('flowchart LR\n  X');
    });
    await user.click(within(chatPanel()).getByRole('button', { name: 'Stop' }));
    expect(await within(chatPanel()).findByText('Stopped.')).toBeTruthy();
    expect(code()).toBe(before);
    expect(await screen.findByText('Claude stopped.')).toBeTruthy();
  });

  it('shows a server error in the chat', async () => {
    replies.push(
      () => new Response(JSON.stringify({ error: 'Claude Code was not found.' }), { status: 500 }),
    );
    const user = await renderApp();
    await sendFromComposer(user, 'Draw');
    expect(await within(chatPanel()).findByText('Claude Code was not found.')).toBeTruthy();
  });

  it('starts a new chat after confirming, and resumes nothing afterwards', async () => {
    replies.push(() => eventsResponse(replyEvents('Hello.')));
    replies.push(() => eventsResponse(replyEvents('Fresh.', 's2')));
    const user = await renderApp();
    await sendFromComposer(user, 'Hi');
    await within(chatPanel()).findByText('Hello.');
    await user.click(within(chatPanel()).getByRole('button', { name: 'New chat' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Start a new chat?' });
    await user.click(within(dialog).getByRole('button', { name: 'Start new chat' }));
    expect(await within(chatPanel()).findByText('Start with a description')).toBeTruthy();
    await sendFromComposer(user, 'Again');
    await within(chatPanel()).findByText('Fresh.');
    expect(chatRequests()[1]?.sessionId).toBeNull();
  });

  it('keeps each diagram’s unsent text', async () => {
    const user = await renderApp();
    act(() => {
      screen.getByLabelText('Message Claude').focus();
    });
    await user.keyboard('Half a thought');
    const firstId = useWorkspaceStore.getState().activeId ?? '';
    await act(async () => useWorkspaceStore.getState().createDiagram());
    expect(screen.getByLabelText<HTMLTextAreaElement>('Message Claude').value).toBe('');
    act(() => {
      useWorkspaceStore.getState().selectDiagram(firstId);
    });
    expect(screen.getByLabelText<HTMLTextAreaElement>('Message Claude').value).toBe(
      'Half a thought',
    );
  });

  it('sends with the model picked in the header chip', async () => {
    replies.push(() => eventsResponse(replyEvents('Ok.')));
    const user = await renderApp();
    act(() => {
      screen.getByRole('button', { name: 'Model: Default' }).focus();
    });
    await user.keyboard('{Enter}');
    await user.click(await screen.findByRole('menuitemradio', { name: 'Haiku' }));
    expect(useUiStore.getState().defaultModel).toBe('haiku');
    await sendFromComposer(user, 'Hi');
    await within(chatPanel()).findByText('Ok.');
    expect(chatRequests()[0]?.model).toBe('haiku');
  });
});

describe('sending from elsewhere', () => {
  it('sends from the floating prompt bar while the chat is closed', async () => {
    useUiStore.getState().setActivePanel(null);
    replies.push(() => eventsResponse(replyEvents(fenced(VALID))));
    const user = await renderApp();
    const input = screen.getByLabelText('Ask Claude to change this diagram');
    await user.type(input, 'Add a done step{Enter}');
    await waitFor(() => {
      expect(code()).toBe(VALID);
    });
    expect(chatRequests()[0]?.message).toBe('Add a done step');
    expect(input).toHaveProperty('value', '');
  });

  it('asks Claude to fix when the code drawer sends the event', async () => {
    replies.push(() => eventsResponse(replyEvents(fenced(VALID))));
    await renderApp();
    act(() => {
      window.dispatchEvent(
        new CustomEvent(ASK_CLAUDE_TO_FIX_EVENT, {
          detail: { message: 'Parse error on line 2', line: 2 },
        }),
      );
    });
    await waitFor(() => {
      expect(code()).toBe(VALID);
    });
    expect(chatRequests()[0]?.message).toBe(
      'The diagram fails to parse:\nParse error on line 2\nFix it.',
    );
    expect(within(chatPanel()).getByText('Fix')).toBeTruthy();
    expect(within(chatPanel()).getByText('Parse error on line 2')).toBeTruthy();
  });

  it('offers "Ask Claude to fix the syntax error" in ⌘K when the code does not parse', async () => {
    replies.push(() => eventsResponse(replyEvents(fenced(VALID))));
    const user = await renderApp();
    act(() => {
      useWorkspaceStore
        .getState()
        .applyEdit('flowchart TD\n  A -->', { label: 'Typed in code', source: 'code' });
    });
    await user.keyboard('{Control>}k{/Control}');
    const palette = await screen.findByRole('dialog', { name: 'Command palette' });
    await waitFor(
      () => {
        const fix = within(palette).getByRole('option', {
          name: 'Ask Claude to fix the syntax error',
        });
        expect(fix.getAttribute('aria-disabled')).toBe('false');
      },
      { timeout: 5000 },
    );
    await user.type(within(palette).getByRole('combobox'), 'fix the syntax');
    await user.keyboard('{Enter}');
    await waitFor(() => {
      expect(code()).toBe(VALID);
    });
    expect(chatRequests()[0]?.message).toMatch(/^The diagram fails to parse:/);
    await waitFor(() => {
      expect(useChatStore.getState().busyDiagramId).toBeNull();
    }, TURN_END);
  });
});
