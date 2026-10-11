import { describe, expect, it } from 'vitest';

import { createId, DB_NAME, openNautinkDb } from './db.ts';

describe('openNautinkDb', () => {
  it('uses the nautink database by default and creates every store', async () => {
    const db = await openNautinkDb();
    expect(db.name).toBe(DB_NAME);
    expect(DB_NAME).toBe('nautink');
    expect([...db.objectStoreNames].sort()).toEqual(['diagrams', 'positions', 'versions']);
    expect([...db.transaction('versions').store.indexNames]).toEqual(['diagramId']);
    expect([...db.transaction('positions').store.indexNames]).toEqual(['diagramId']);
    db.close();
  });

  it('opens an existing database without recreating its stores', async () => {
    const first = await openNautinkDb('nautink-reopen');
    await first.put('diagrams', {
      id: 'kept',
      title: '',
      titleAuto: true,
      code: '',
      view: 'preview',
      messages: [],
      sessionId: null,
      pinned: false,
      draft: '',
      createdAt: 1,
      updatedAt: 1,
    });
    first.close();
    const second = await openNautinkDb('nautink-reopen');
    expect((await second.get('diagrams', 'kept'))?.id).toBe('kept');
    second.close();
  });
});

describe('createId', () => {
  it('returns a different id each call', () => {
    expect(createId()).not.toBe(createId());
  });
});
