import { serialize } from '@nautink/editors/sequence/model';
import { describe, expect, it } from 'vitest';

import {
  addSection,
  removeBox,
  removeSection,
  renameParticipant,
  reverseMessage,
  setAutonumberStart,
  setBlockKind,
  setParticipantBox,
  setSectionLabel,
  toggleAutonumber,
  unwrapBlock,
  updateBox,
  updateItem,
  wrapRows,
} from './sequence-actions.ts';
import {
  addMessage,
  addMessageAt,
  addNote,
  addNoteOn,
  addParticipant,
  dropBlock,
  dropNote,
  insertSlot,
  wrapSelection,
} from './sequence-add.ts';
import { deleteSelection, moveRows, stepParticipant, stepRows } from './sequence-moves.ts';
import { applyDragOutcome, applyDropOutcome } from './sequence-outcomes.ts';
import { commitText, inlineField } from './sequence-text.ts';
import { itemSelection, NO_SELECTION, participantSelection } from './sequence-types.ts';
import { layoutOf, sampleModel, testContext } from '../../../tests/sequence-fixtures.ts';

import type { TestContext } from '../../../tests/sequence-fixtures.ts';

async function context(code?: string): Promise<TestContext> {
  return testContext(await sampleModel(code));
}

function lastLabel(ctx: TestContext): string | undefined {
  return ctx.commits.mock.lastCall?.[1];
}

function code(ctx: TestContext): string {
  return serialize(ctx.model());
}

describe('participant and box edits', () => {
  it('renames, boxes and unboxes participants', async () => {
    const ctx = await context();
    renameParticipant(ctx, 'A', 'Ann');
    expect(lastLabel(ctx)).toBe('Renamed A → Ann');
    expect(ctx.selection()).toEqual(participantSelection('Ann'));
    renameParticipant(ctx, 'Ann', 'B');
    expect(ctx.commits).toHaveBeenCalledTimes(1);
    setParticipantBox(ctx, 'B', 'new');
    expect(lastLabel(ctx)).toBe('Moved Bob into a box');
    updateBox(ctx, 'box1', { name: 'Back' });
    expect(code(ctx)).toContain('box Back');
    setParticipantBox(ctx, 'B', null);
    expect(lastLabel(ctx)).toBe('Moved Bob out of its box');
    setParticipantBox(ctx, 'B', 'new');
    removeBox(ctx, ctx.model().boxes[0]!.id);
    expect(lastLabel(ctx)).toBe('Removed box');
    expect(ctx.model().boxes).toEqual([]);
  });

  it('adds participants after the selected one, opening their name', async () => {
    const ctx = await context();
    ctx.select(participantSelection('A'));
    addParticipant(ctx, 'database');
    expect(lastLabel(ctx)).toBe('Added database Database');
    expect(ctx.model().participants.map((participant) => participant.id)).toEqual([
      'A',
      'Database',
      'B',
    ]);
    expect(ctx.editing()).toEqual({ kind: 'participant', id: 'Database' });
  });

  it('does nothing while read-only', async () => {
    const ctx = await context();
    ctx.setReadOnly(true);
    addParticipant(ctx, 'actor');
    toggleAutonumber(ctx);
    expect(ctx.commits).not.toHaveBeenCalled();
  });
});

describe('row edits', () => {
  it('edits, reverses and numbers messages', async () => {
    const ctx = await context();
    updateItem(ctx, 'i0', { text: 'Hey' });
    expect(lastLabel(ctx)).toBe('Edited text of message Alice → Bob');
    reverseMessage(ctx, 'i0');
    expect(code(ctx)).toContain('B->>A: Hey');
    toggleAutonumber(ctx);
    expect(lastLabel(ctx)).toBe('Turned autonumber on');
    toggleAutonumber(ctx);
    expect(lastLabel(ctx)).toBe('Turned autonumber off');
  });

  it('edits blocks and their sections', async () => {
    const ctx = await context();
    setBlockKind(ctx, 'i1', 'alt');
    expect(lastLabel(ctx)).toBe('Changed block to alt');
    addSection(ctx, 'i1');
    expect(lastLabel(ctx)).toBe('Added section to alt block');
    setSectionLabel(ctx, { blockId: 'i1', sectionIndex: 1, label: 'never' });
    expect(code(ctx)).toContain('else never');
    removeSection(ctx, { blockId: 'i1', sectionIndex: 1 });
    expect(lastLabel(ctx)).toBe('Removed section from alt block');
    unwrapBlock(ctx, 'i1');
    expect(lastLabel(ctx)).toBe('Unwrapped alt');
    expect(ctx.selection()).toEqual(itemSelection(['i2', 'i3']));
  });

  it('wraps rows and the selection in blocks', async () => {
    const ctx = await context();
    wrapRows(ctx, ['i0'], 'opt');
    expect(lastLabel(ctx)).toBe('Wrapped 1 row in opt');
    ctx.select(NO_SELECTION);
    wrapSelection(ctx, 'break');
    expect(lastLabel(ctx)).toBe('Added break block');
  });

  it('restarts and continues autonumber rows', async () => {
    const ctx = await context(
      'sequenceDiagram\n    A->>B: one\n    autonumber 3\n    A->>B: two\n',
    );
    setAutonumberStart(ctx, 'i1', 7);
    expect(lastLabel(ctx)).toBe('Restarted numbering at 7');
    setAutonumberStart(ctx, 'i1', undefined);
    expect(lastLabel(ctx)).toBe('Continued the numbering');
  });
});

describe('adding rows', () => {
  it('adds messages after the selection, answering a selected message', async () => {
    const ctx = await context();
    ctx.select(itemSelection(['i0']));
    addMessage(ctx);
    expect(lastLabel(ctx)).toBe('Added message Bob → Alice');
    expect(ctx.editing()?.kind).toBe('message');
    ctx.select(participantSelection('B'));
    addMessage(ctx);
    expect(lastLabel(ctx)).toBe('Added message Bob → Alice');
    addMessageAt(ctx, { from: 'A', to: 'A', slot: { key: 'root', index: 0 } });
    expect(code(ctx)).toMatch(/sequenceDiagram[\s\S]*?A->>A:/);
  });

  it('adds notes from the toolbar, the inspector and a drop', async () => {
    const ctx = await context();
    ctx.select(itemSelection(['i0']));
    addNote(ctx);
    expect(lastLabel(ctx)).toBe('Added note on Bob');
    addNoteOn(ctx, 'A', 'i0');
    expect(lastLabel(ctx)).toBe('Added note on Alice');
    dropNote(ctx, { actor: 'B', placement: 'left', slot: { key: 'root', index: 0 } });
    expect(code(ctx)).toContain('Note left of B: Note');
    expect(ctx.editing()?.kind).toBe('note');
  });

  it('finds where new rows go', async () => {
    const model = await sampleModel();
    expect(insertSlot(model, itemSelection(['i2']))).toEqual({ key: 'i1:0', index: 1 });
    expect(insertSlot(model, NO_SELECTION)).toEqual({ key: 'root', index: 3 });
  });

  it('drops an empty block at a slot', async () => {
    const ctx = await context();
    dropBlock(ctx, 'critical', { key: 'root', index: 0 });
    expect(code(ctx)).toMatch(/sequenceDiagram[\s\S]*?critical must succeed\n\s+option on error/);
  });
});

describe('deleting and moving', () => {
  it('deletes rows, participants and boxes', async () => {
    const ctx = await context();
    ctx.select(itemSelection(['i0']));
    deleteSelection(ctx);
    expect(lastLabel(ctx)).toBe('Deleted message Alice → Bob');
    expect(ctx.selection()).toEqual(NO_SELECTION);
    ctx.select(participantSelection('A'));
    deleteSelection(ctx);
    expect(lastLabel(ctx)).toBe('Deleted Alice');
    deleteSelection(ctx);
    expect(ctx.commits).toHaveBeenCalledTimes(2);
  });

  it('moves and steps rows and participants', async () => {
    const ctx = await context();
    moveRows(ctx, ['i4'], { key: 'root', index: 0 });
    expect(lastLabel(ctx)).toBe('Moved message Bob → Alice');
    stepRows(ctx, ['i4', 'i0'], 1);
    expect(lastLabel(ctx)).toBe('Moved 2 rows');
    stepParticipant(ctx, 'A', 1);
    expect(ctx.model().participants.map((participant) => participant.id)).toEqual(['B', 'A']);
    stepParticipant(ctx, 'A', 1);
    stepParticipant(ctx, 'nobody', -1);
    expect(ctx.commits).toHaveBeenCalledTimes(3);
  });

  it('applies drag and drop outcomes', async () => {
    const ctx = await context();
    applyDragOutcome(ctx, { kind: 'moveParticipant', id: 'B', to: 0 });
    expect(ctx.selection()).toEqual(participantSelection('B'));
    applyDragOutcome(ctx, { kind: 'moveRows', ids: ['i0'], slot: { key: 'root', index: 3 } });
    expect(ctx.selection()).toEqual(itemSelection(['i0']));
    applyDragOutcome(ctx, { kind: 'clear' });
    expect(ctx.selection()).toEqual(NO_SELECTION);
    applyDragOutcome(ctx, { kind: 'none' });
    applyDragOutcome(ctx, {
      kind: 'addMessage',
      from: 'A',
      to: 'B',
      slot: { key: 'root', index: 0 },
    });
    applyDropOutcome(ctx, { kind: 'participant', participantKind: 'queue', index: 0 });
    expect(ctx.model().participants[0]?.kind).toBe('queue');
    applyDropOutcome(ctx, {
      kind: 'note',
      actor: 'A',
      placement: 'right',
      slot: { key: 'root', index: 0 },
    });
    applyDropOutcome(ctx, { kind: 'block', blockKind: 'rect', slot: { key: 'root', index: 0 } });
    expect(lastLabel(ctx)).toBe('Added rect block');
  });
});

describe('inline text', () => {
  it('places the field for each kind of text', async () => {
    const model = await sampleModel();
    const layout = layoutOf(model);
    expect(inlineField(layout, { kind: 'participant', id: 'A' })?.value).toBe('Alice');
    expect(inlineField(layout, { kind: 'message', id: 'i0' })?.value).toBe('Hello');
    expect(inlineField(layout, { kind: 'note', id: 'i3' })?.value).toBe('busy');
    expect(inlineField(layout, { kind: 'section', id: 'i1', sectionIndex: 0 })?.value).toBe(
      'every minute',
    );
    expect(inlineField(layout, { kind: 'section', id: 'i1', sectionIndex: 4 })).toBeNull();
    expect(inlineField(layout, { kind: 'message', id: 'nope' })).toBeNull();
    expect(inlineField(layout, { kind: 'participant', id: 'nope' })).toBeNull();
    expect(inlineField(layout, { kind: 'section', id: 'nope', sectionIndex: 0 })).toBeNull();
  });

  it('writes changed text only, and closes the field', async () => {
    const ctx = await context();
    ctx.edit({ kind: 'message', id: 'i0' });
    commitText(ctx, { kind: 'message', id: 'i0' }, 'Hello');
    expect(ctx.commits).not.toHaveBeenCalled();
    expect(ctx.editing()).toBeNull();
    commitText(ctx, { kind: 'note', id: 'i3' }, 'very\nbusy');
    expect(code(ctx)).toContain('Note right of B: very<br>busy');
    commitText(ctx, { kind: 'participant', id: 'B' }, '  ');
    expect(code(ctx)).not.toContain('as Bob');
    commitText(ctx, { kind: 'section', id: 'i1', sectionIndex: 0 }, 'every\nhour');
    expect(code(ctx)).toContain('loop every hour');
    commitText(ctx, { kind: 'section', id: 'i1', sectionIndex: 0 }, 'every hour');
    expect(ctx.commits).toHaveBeenCalledTimes(3);
  });
});
