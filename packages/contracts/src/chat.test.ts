import { describe, expect, it } from 'vitest';

import { chatEventSchema, chatRequestSchema } from './chat.ts';
import { MODEL_LABELS } from './models.ts';
import { API_ROUTES } from './routes.ts';
import {
  errorResponseSchema,
  healthResponseSchema,
  infoResponseSchema,
  repoRequestSchema,
} from './server-info.ts';

const VALID_REQUEST = {
  message: 'Add a retry path',
  code: 'flowchart TD\n  a --> b',
  sessionId: null,
  model: 'sonnet',
  selection: { ids: ['a'], labels: ['Start'] },
};

describe('chatRequestSchema', () => {
  it('accepts a full request', () => {
    expect(chatRequestSchema.parse(VALID_REQUEST)).toEqual(VALID_REQUEST);
  });

  it('accepts the CLI default model and no selection', () => {
    const request = { ...VALID_REQUEST, model: null, selection: null, sessionId: 'abc' };
    expect(chatRequestSchema.parse(request)).toEqual(request);
  });

  it('rejects a blank message', () => {
    expect(() => chatRequestSchema.parse({ ...VALID_REQUEST, message: '   ' })).toThrow(
      'message is required',
    );
  });

  it('rejects an unknown model and an empty selection', () => {
    expect(() => chatRequestSchema.parse({ ...VALID_REQUEST, model: 'gpt' })).toThrow();
    const emptySelection = { ...VALID_REQUEST, selection: { ids: [], labels: [] } };
    expect(() => chatRequestSchema.parse(emptySelection)).toThrow();
  });
});

describe('chatEventSchema', () => {
  it('accepts every event type', () => {
    const events = [
      { type: 'session', sessionId: 's1', model: 'claude-sonnet' },
      { type: 'delta', text: 'Hi' },
      { type: 'turn' },
      { type: 'tool', label: 'Read src/app.ts' },
      { type: 'done', sessionId: 's1', text: 'ok', isError: false, durationMs: 10, costUsd: 0 },
      { type: 'error', message: 'claude exited with code 1' },
    ];
    for (const event of events) {
      expect(chatEventSchema.parse(event)).toEqual(event);
    }
  });

  it('rejects an unknown event type', () => {
    expect(() => chatEventSchema.parse({ type: 'progress' })).toThrow();
  });
});

describe('server info schemas', () => {
  it('parse the info, health, repo and error bodies', () => {
    expect(infoResponseSchema.parse({ repoDir: null })).toEqual({ repoDir: null });
    const health = { claude: { isFound: true, version: '2.1.0', error: null } };
    expect(healthResponseSchema.parse(health)).toEqual(health);
    expect(repoRequestSchema.parse({ path: ' ~/dev/app ' })).toEqual({ path: '~/dev/app' });
    expect(() => repoRequestSchema.parse({ path: '' })).toThrow();
    expect(errorResponseSchema.parse({ error: 'bad' })).toEqual({ error: 'bad' });
  });

  it('name every route and model', () => {
    expect(API_ROUTES.chat).toBe('/api/chat');
    expect(MODEL_LABELS.opus).toBe('Opus');
  });
});
