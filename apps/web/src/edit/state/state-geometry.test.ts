import { addRegion, addState } from '@nautink/editors/state/ops';
import { describe, expect, it } from 'vitest';

import { boxOf, carriedBy, isInside, placeAt, scopeAt, stateGeometry } from './state-geometry.ts';
import { placeMissing, renamedKey, renamedPositions } from './state-positions.ts';
import { sampleModel, samplePositions } from '../../../tests/state-fixtures.ts';

import type { LeafData } from '@nautink/editors/state/size';

describe('state geometry', () => {
  it('boxes leaves from their spots and frames around what they hold', () => {
    const geometry = stateGeometry(sampleModel(), samplePositions());
    expect(boxOf(geometry, 'Idle')).toMatchObject({ x: 0, y: 100 });
    const frame = boxOf(geometry, 'Box');
    expect(frame?.x).toBeLessThan(400);
    expect(boxOf(geometry, 'nowhere')).toBeUndefined();
    expect(isInside({ x: 420, y: 120 }, frame)).toBe(true);
    expect(isInside({ x: 0, y: 0 }, undefined)).toBe(false);
  });

  it('finds the innermost scope under a point: an empty composite, a composite or a region', () => {
    const model = sampleModel();
    const positions = samplePositions();
    expect(scopeAt(stateGeometry(model, positions), { x: 420, y: 120 })).toBe('Box');
    expect(scopeAt(stateGeometry(model, positions), { x: -500, y: -500 })).toBeNull();
    const empty = addState(model, { id: 'Empty', isComposite: true });
    const spots = { ...positions, Empty: { x: 700, y: 0 } };
    expect(scopeAt(stateGeometry(empty, spots), { x: 710, y: 10 })).toBe('Empty');
    const regions = addRegion(model, 'Box', 'Second');
    const regionSpots = { ...positions, Second: { x: 400, y: 300 } };
    const geometry = stateGeometry(regions, regionSpots);
    expect(scopeAt(geometry, { x: 420, y: 320 })).toBe('Box#1');
    const frame = boxOf(geometry, 'Box');
    expect(scopeAt(geometry, { x: (frame?.x ?? 0) + 2, y: (frame?.y ?? 0) + 2 })).toBe('Box#0');
  });

  it('places a new item in free space, clear of frames it is not inside', () => {
    const model = sampleModel();
    const positions = samplePositions();
    const data: LeafData = { kind: 'state', label: 'New', desc: [] };
    const inside = placeAt({ model, positions, data, at: { x: 450, y: 120 }, scope: 'Box' });
    const outside = placeAt({ model, positions, data, at: { x: 450, y: 120 }, scope: null });
    expect(isInside(outside, boxOf(stateGeometry(model, positions), 'Box'))).toBe(false);
    expect(inside).not.toEqual(outside);
    const margin = { left: 24, top: 46, right: 24, bottom: 24 };
    const framed = placeAt({
      model,
      positions,
      data,
      at: { x: 2000, y: 2000 },
      scope: null,
      margin,
    });
    expect(framed.x).toBeGreaterThan(1900);
  });

  it('lists what a composite or a state carries when it moves', () => {
    const model = sampleModel();
    const geometry = stateGeometry(model, samplePositions());
    expect(carriedBy(model, geometry, 'Box')).toEqual(['Inner']);
    expect(carriedBy(model, geometry, 'Idle')).toEqual(['note:Idle:0']);
    expect(carriedBy(model, geometry, 'Busy')).toEqual([]);
  });
});

describe('state positions', () => {
  it('moves the spots of a renamed state, its [*] and its notes', () => {
    expect(renamedKey('Box', 'Box', 'Frame')).toBe('Frame');
    expect(renamedKey('start:Box', 'Box', 'Frame')).toBe('start:Frame');
    expect(renamedKey('end:Box#1', 'Box', 'Frame')).toBe('end:Frame#1');
    expect(renamedKey('start:Boxer', 'Box', 'Frame')).toBe('start:Boxer');
    expect(renamedKey('start:', 'Box', 'Frame')).toBe('start:');
    expect(renamedKey('note:Box:2', 'Box', 'Frame')).toBe('note:Frame:2');
    expect(renamedKey('Idle', 'Box', 'Frame')).toBe('Idle');
    expect(renamedPositions({ Box: { x: 1, y: 2 } }, 'Box', 'Frame')).toEqual({
      Frame: { x: 1, y: 2 },
    });
  });

  it('gives a spot to leaves an edit made without one', () => {
    const previous = sampleModel();
    const positions = samplePositions();
    expect(placeMissing({ previous, next: previous, positions })).toBe(positions);
    const emptied = {
      ...previous,
      states: previous.states.filter((state) => state.id !== 'Inner'),
    };
    const frame = boxOf(stateGeometry(previous, positions), 'Box');
    expect(placeMissing({ previous, next: emptied, positions }).Box).toEqual({
      x: frame?.x,
      y: frame?.y,
    });
    const added = addState(previous, { id: 'Later' });
    const linked = {
      ...added,
      transitions: [...added.transitions, { id: 't9', from: 'Busy', to: 'Later', label: '' }],
    };
    expect(placeMissing({ previous, next: linked, positions }).Later).toBeDefined();
  });
});
