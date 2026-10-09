import { describe, expect, it } from 'vitest';

import {
  allScopes,
  displayName,
  endId,
  isValidId,
  nodeScope,
  pseudoOf,
  regionOf,
  regionScope,
  regionScopes,
  scopeChain,
  scopeExists,
  scopeInsideState,
  scopeLabel,
  scopeParent,
  scopeWithin,
  startId,
  stateById,
  uniqueId,
} from './scopes.ts';

import type { StateNode } from './types.ts';

const state = (id: string, patch: Partial<StateNode> = {}): StateNode => ({
  id,
  type: 'state',
  isComposite: false,
  regions: 0,
  name: '',
  desc: [],
  parent: null,
  classes: [],
  dir: '',
  ...patch,
});

const model = {
  states: [
    state('Outer', { isComposite: true, name: 'The outer' }),
    state('Par', { isComposite: true, regions: 2, parent: 'Outer' }),
    state('A', { parent: 'Par#0' }),
    state('B', { parent: 'Par#1' }),
    state('C', { parent: 'Outer' }),
    state('Top'),
  ],
};

describe('pseudo ids', () => {
  it('builds and reads start and end ids', () => {
    expect(startId(null)).toBe('start:');
    expect(endId('X')).toBe('end:X');
    expect(pseudoOf('start:')).toEqual({ kind: 'start', scope: null });
    expect(pseudoOf('end:Par#1')).toEqual({ kind: 'end', scope: 'Par#1' });
    expect(pseudoOf('A')).toBeNull();
  });
});

describe('regions', () => {
  it('names region scopes and reads them back', () => {
    expect(regionScope('Par', 1)).toBe('Par#1');
    expect(regionScopes('Par', 2)).toEqual(['Par#0', 'Par#1']);
    expect(regionOf(model, 'Par#1')).toEqual({ id: 'Par', index: 1 });
    expect(regionOf(model, 'Outer#0')).toBeNull();
    expect(regionOf(model, 'Nope#0')).toBeNull();
    expect(regionOf(model, null)).toBeNull();
  });
});

describe('scopes', () => {
  it('walks up from a scope', () => {
    expect(scopeParent(model, 'Par#0')).toBe('Par');
    expect(scopeParent(model, 'Par')).toBe('Outer');
    expect(scopeParent(model, 'Outer')).toBeNull();
    expect(scopeParent(model, null)).toBeUndefined();
    expect(scopeChain(model, 'Par#1')).toEqual(['Par#1', 'Par', 'Outer']);
  });

  it('lists and checks scopes', () => {
    expect(allScopes(model)).toEqual([null, 'Outer', 'Par#0', 'Par#1']);
    expect(scopeExists(model, null)).toBe(true);
    expect(scopeExists(model, 'Par#1')).toBe(true);
    expect(scopeExists(model, 'Par#2')).toBe(false);
    expect(scopeExists(model, 'Par')).toBe(false);
    expect(scopeExists(model, 'A')).toBe(false);
  });

  it('finds the scope of nodes and nesting', () => {
    expect(nodeScope(model, 'A')).toBe('Par#0');
    expect(nodeScope(model, 'end:Outer')).toBe('Outer');
    expect(nodeScope(model, 'missing')).toBeNull();
    expect(scopeWithin(model, 'Par#0', 'Outer')).toBe(true);
    expect(scopeWithin(model, 'Outer', 'Par')).toBe(false);
    expect(scopeWithin(model, 'Outer', null)).toBe(true);
    expect(scopeInsideState(model, 'Par#1', 'Par')).toBe(true);
    expect(scopeInsideState(model, 'Outer', 'Par')).toBe(false);
  });

  it('labels scopes', () => {
    expect(scopeLabel(model, null)).toBe('Top level');
    expect(scopeLabel(model, 'Outer')).toBe('The outer');
    expect(scopeLabel(model, 'Par#1')).toBe('Par › region 2');
    expect(scopeLabel(model, 'ghost')).toBe('ghost');
  });
});

describe('ids', () => {
  it('validates ids and finds free ones', () => {
    expect(isValidId('Idle_2')).toBe(true);
    expect(isValidId('2x')).toBe(false);
    expect(isValidId('note')).toBe(false);
    expect(uniqueId({ states: [state('State1')] })).toBe('State2');
    expect(uniqueId(model, 'Composite')).toBe('Composite1');
    expect(stateById(model, 'C')?.parent).toBe('Outer');
    expect(displayName(state('X'))).toBe('X');
  });
});
