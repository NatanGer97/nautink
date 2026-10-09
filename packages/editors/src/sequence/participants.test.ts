import { describe, expect, it } from 'vitest';

import { emptyModel, parse } from './model.ts';
import {
  addParticipant,
  deleteParticipant,
  moveParticipant,
  participantRefs,
  removeBox,
  renameParticipant,
  setParticipantBox,
  updateBox,
  updateParticipant,
  validParticipantId,
} from './participants.ts';
import { SEQUENCE_FIXTURES } from '../../tests/fixtures/sequence.ts';
import { parseOk } from '../../tests/parse-ok.ts';

import type { SequenceModel } from './types.ts';

const read = async (code: string): Promise<SequenceModel> => parseOk(parse, code);
const order = (model: SequenceModel): string[] =>
  model.participants.map(
    (participant) => `${participant.id}${participant.box ? `@${participant.box}` : ''}`,
  );

describe('adding and editing', () => {
  it('adds participants with kind-based ids, before created ones and inside boxes', async () => {
    expect(addParticipant(emptyModel()).id).toBe('P1');
    expect(addParticipant(emptyModel(), { kind: 'actor' }).id).toBe('Actor');
    expect(
      addParticipant(emptyModel(), { kind: 'database', label: 'DB' }).model.participants[0],
    ).toMatchObject({ id: 'Database', label: 'DB' });
    const lifecycle = await read(SEQUENCE_FIXTURES.lifecycle!);
    expect(order(addParticipant(lifecycle).model)).toEqual(['A', 'B', 'P1', 'C', 'D']);
    const boxes = await read(SEQUENCE_FIXTURES.boxes!);
    expect(order(addParticipant(boxes, { index: 1 }).model)[1]).toBe('P1@box1');
  });

  it('patches participants and boxes', async () => {
    const boxes = await read(SEQUENCE_FIXTURES.boxes!);
    expect(updateParticipant(boxes, 'A', { label: 'Alpha' }).participants[0]!.label).toBe('Alpha');
    expect(updateBox(boxes, 'box1', { name: 'X' }).boxes[0]!.name).toBe('X');
  });
});

describe('renaming', () => {
  it('renames a participant everywhere', async () => {
    const model = await read(SEQUENCE_FIXTURES.text!);
    const renamed = renameParticipant(model, 'A', 'Z');
    expect(renamed.participants[0]).toMatchObject({ id: 'Z', label: 'Z' });
    expect(renamed.items[0]).toMatchObject({ from: 'Z' });
    expect(renamed.extra[0]).toBe('link Z: Dashboard @ https://example.com');
    const lifecycle = renameParticipant(await read(SEQUENCE_FIXTURES.lifecycle!), 'C', 'Y');
    expect(
      lifecycle.items
        .map((item) => (item.t === 'msg' ? [...item.create, ...item.destroy] : []))
        .flat(),
    ).toEqual(['Y', 'D', 'Y']);
    const notes = renameParticipant(
      await read(`${SEQUENCE_FIXTURES.notes!}    activate A\n`),
      'A',
      'Z',
    );
    expect(notes.items.at(-1)).toMatchObject({ actor: 'Z' });
    expect(notes.items[0]).toMatchObject({ actors: ['Z'] });
  });

  it('leaves other item kinds alone', async () => {
    const model = await read(
      `${SEQUENCE_FIXTURES.minimal!}    autonumber\n    loop x\n        Alice->>Bob: y\n    end\n`,
    );
    expect(renameParticipant(model, 'Alice', 'Ann').items[1]).toEqual(model.items[1]);
    expect(participantRefs(model, 'Alice')).toBe(2);
  });

  it('refuses invalid and taken ids', async () => {
    const model = await read(SEQUENCE_FIXTURES.minimal!);
    expect(renameParticipant(model, 'Alice', 'Bob')).toBe(model);
    expect(renameParticipant(model, 'Alice', 'a b')).toBe(model);
    expect(renameParticipant(model, 'Alice', 'Alice')).toBe(model);
    expect(validParticipantId('a.b_1')).toBe(true);
  });
});

describe('deleting', () => {
  it('counts and removes every item that references a participant', async () => {
    const model = await read(
      `${SEQUENCE_FIXTURES.notes!}    activate A\n    A->>B: x\n    link A: L @ u\n`,
    );
    expect(participantRefs(model, 'A')).toBe(5);
    const next = deleteParticipant(model, 'A');
    expect(next.participants.map((participant) => participant.id)).toEqual(['B']);
    expect(next.items.map((item) => item.t === 'note' && item.actors)).toEqual([['B'], ['B']]);
    expect(next.extra).toEqual([]);
  });

  it('drops destroy markers and empty boxes', async () => {
    const lifecycle = await read(`${SEQUENCE_FIXTURES.lifecycle!}    destroy D\n    A->>D: end\n`);
    expect(deleteParticipant(lifecycle, 'C').items.at(-1)).toMatchObject({ destroy: ['D'] });
    const boxes = await read(SEQUENCE_FIXTURES.boxes!);
    expect(deleteParticipant(boxes, 'C').boxes.map((box) => box.id)).toEqual([
      'box1',
      'box3',
      'box4',
    ]);
  });
});

describe('moving and boxes', () => {
  it('moves a column, joining or leaving boxes with its neighbours', async () => {
    const boxes = await read(SEQUENCE_FIXTURES.boxes!);
    expect(order(moveParticipant(boxes, 'E', 1))).toEqual([
      'A@box1',
      'E@box1',
      'B@box1',
      'C@box2',
      'D@box3',
    ]);
    expect(order(moveParticipant(boxes, 'A', 5))).toEqual([
      'B@box1',
      'C@box2',
      'D@box3',
      'E@box4',
      'A',
    ]);
    expect(order(moveParticipant(boxes, 'A', 1))).toEqual(order(boxes));
    expect(moveParticipant(boxes, 'nope', 0)).toBe(boxes);
    const lifecycle = await read(SEQUENCE_FIXTURES.lifecycle!);
    expect(moveParticipant(lifecycle, 'C', 0)).toBe(lifecycle);
  });

  it('puts participants in boxes and takes them out', async () => {
    const boxes = await read(SEQUENCE_FIXTURES.boxes!);
    expect(order(setParticipantBox(boxes, 'E', 'box1'))).toEqual([
      'A@box1',
      'B@box1',
      'E@box1',
      'C@box2',
      'D@box3',
    ]);
    expect(order(setParticipantBox(boxes, 'A', null))).toEqual([
      'B@box1',
      'A',
      'C@box2',
      'D@box3',
      'E@box4',
    ]);
    expect(order(setParticipantBox(boxes, 'B', ''))).toEqual([
      'A@box1',
      'B',
      'C@box2',
      'D@box3',
      'E@box4',
    ]);
    const fresh = setParticipantBox(boxes, 'C', 'new');
    expect(fresh.boxes.at(-1)).toEqual({ id: 'box5', name: 'Group', fill: 'transparent' });
    expect(order(fresh)[2]).toBe('C@box5');
    expect(order(setParticipantBox(boxes, 'C', 'box9'))[2]).toBe('C@box9');
    expect(setParticipantBox(boxes, 'nope', null)).toBe(boxes);
  });

  it('removes a box, keeping its members', async () => {
    const boxes = await read(SEQUENCE_FIXTURES.boxes!);
    const next = removeBox(boxes, 'box1');
    expect(order(next).slice(0, 2)).toEqual(['A', 'B']);
    expect(next.boxes.map((box) => box.id)).toEqual(['box2', 'box3', 'box4']);
  });
});
