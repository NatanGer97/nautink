import { describe, expect, it } from 'vitest';

import { hitFromElement, locateLine } from './locate.ts';

function svgTree(markup: string): { root: Element; find: (selector: string) => Element } {
  const root = document.createElement('div');
  root.innerHTML = markup;
  return {
    root,
    find: (selector: string): Element => {
      const element = root.querySelector(selector);
      if (element === null) {
        throw new Error(`No element matches ${selector}`);
      }
      return element;
    },
  };
}

describe('hitFromElement', () => {
  it('reads flowchart, class, entity and state ids from ancestors', () => {
    const { root, find } = svgTree(`
      <svg>
        <g id="nautink-render-1-flowchart-Login_Page-12"><rect></rect><text>Login</text></g>
        <g id="x-classId-Order-3"><text class="c">Order</text></g>
        <g id="x-entity-CUSTOMER-0"><text class="e">CUSTOMER</text></g>
        <g id="x-state-Idle_start-2"><circle class="s"></circle></g>
        <g id="x-state-root_start-2"><circle class="root"></circle></g>
      </svg>`);
    expect(hitFromElement(find('rect'), root)).toEqual({ ids: ['Login_Page'], text: 'Login' });
    expect(hitFromElement(find('text'), root)).toEqual({ ids: ['Login_Page'], text: 'Login' });
    expect(hitFromElement(find('.c'), root).ids).toEqual(['Order']);
    expect(hitFromElement(find('.e'), root).ids).toEqual(['CUSTOMER']);
    expect(hitFromElement(find('.s'), root).ids).toEqual(['Idle']);
    expect(hitFromElement(find('.root'), root).ids).toEqual([]);
  });

  it('reads name and meaningful data-id attributes, and keeps short text without ids', () => {
    const { root, find } = svgTree(`
      <svg>
        <g name="Alice"><text class="a">Alice</text></g>
        <path class="edge" data-id="L_A_B_0"></path>
        <g data-id="edge3"><text class="l">yes</text></g>
      </svg>`);
    expect(hitFromElement(find('.a'), root)).toEqual({ ids: ['Alice'], text: 'Alice' });
    expect(hitFromElement(find('.edge'), root).ids).toEqual(['L_A_B_0']);
    expect(hitFromElement(find('.l'), root)).toEqual({ ids: [], text: 'yes' });
  });
});

describe('locateLine', () => {
  const code = [
    'flowchart TD',
    '  Start --> Login_Page',
    '  Login_Page[Login page] --> Done',
    '  Done --> |retry| Login_Page',
    '  Mid',
  ].join('\n');

  it('prefers the line that declares a node over one that mentions it', () => {
    const classes = 'classDiagram\n  Customer "1" -- "*" Order\n  class Order {\n  }';
    expect(locateLine(classes, { ids: ['Order'], text: '' })).toBe(3);
    expect(locateLine(code, { ids: ['Start'], text: '' })).toBe(2);
    expect(locateLine(code, { ids: ['Mid'], text: '' })).toBe(5);
  });

  it('finds an edge by both ends, ids with underscores included', () => {
    expect(locateLine(code, { ids: ['L_Done_Login_Page_0'], text: '' })).toBe(3);
    expect(locateLine(code, { ids: ['L_Start_Login_Page_0'], text: '' })).toBe(2);
    expect(locateLine(code, { ids: ['L_Nope_Gone_0'], text: '' })).toBeNull();
  });

  it('falls back to the clicked text, and gives up on nothing useful', () => {
    expect(locateLine(code, { ids: ['Unknown'], text: 'retry' })).toBe(4);
    expect(locateLine(code, { ids: [], text: 'x' })).toBeNull();
    expect(locateLine(code, { ids: [], text: '' })).toBeNull();
    expect(locateLine(code, { ids: [], text: 'flowchart' })).toBeNull();
  });

  it('matches whole words only', () => {
    expect(
      locateLine('sequenceDiagram\n  participant Al\n  participant Alice', {
        ids: ['Alice'],
        text: '',
      }),
    ).toBe(3);
  });
});
