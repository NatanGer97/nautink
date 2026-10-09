import { describe, expect, it, vi } from 'vitest';

import { ViewController } from './view-controller.ts';

function fittedController(): ViewController {
  const controller = new ViewController();
  controller.setViewport({ width: 848, height: 848 });
  controller.setContent({ width: 400, height: 200 });
  return controller;
}

describe('ViewController', () => {
  it('follows the diagram: fits when the content or the viewport changes', () => {
    const controller = fittedController();
    expect(controller.getView()).toEqual({ k: 2, x: 24, y: 224 });
    controller.setViewport({ width: 448, height: 448 });
    expect(controller.getView().k).toBe(1);
  });

  it('stops following after a manual zoom, until fit or a new diagram', () => {
    const controller = fittedController();
    controller.zoomBy(0.5);
    expect(controller.getView().k).toBe(1);
    controller.setContent({ width: 100, height: 100 });
    expect(controller.getView().k).toBe(1);
    controller.fit();
    expect(controller.getView().k).toBe(2);
    controller.zoomBy(0.5);
    controller.follow();
    controller.setContent({ width: 800, height: 400 });
    expect(controller.getView().k).toBe(1);
  });

  it('zooms around the viewport center', () => {
    const controller = fittedController();
    controller.zoomBy(0.5);
    expect(controller.getView()).toEqual({ k: 1, x: 224, y: 324 });
  });

  it('pans with the wheel and zooms with ⌘/Ctrl + wheel at the cursor', () => {
    const controller = fittedController();
    controller.wheel({ at: { x: 0, y: 0 }, deltaX: 10, deltaY: 20, isZoom: false });
    expect(controller.getView()).toEqual({ k: 2, x: 14, y: 204 });
    controller.wheel({ at: { x: 14, y: 204 }, deltaX: 0, deltaY: -100, isZoom: true });
    expect(controller.getView().x).toBeCloseTo(14);
    expect(controller.getView().k).toBeGreaterThan(2);
  });

  it('drags to pan and reports a press that did not move as a click', () => {
    const controller = fittedController();
    const target = new EventTarget();
    controller.pointerDown({ x: 100, y: 100 }, target);
    controller.pointerMove({ x: 102, y: 101 });
    expect(controller.pointerUp()).toBe(target);
    controller.pointerDown({ x: 100, y: 100 }, target);
    controller.pointerMove({ x: 130, y: 90 });
    controller.pointerMove({ x: 131, y: 90 });
    expect(controller.getView()).toEqual({ k: 2, x: 55, y: 214 });
    expect(controller.pointerUp()).toBeNull();
    controller.pointerMove({ x: 500, y: 500 });
    expect(controller.getView().x).toBe(55);
    expect(controller.pointerUp()).toBeNull();
  });

  it('notifies subscribers until they unsubscribe', () => {
    const controller = new ViewController();
    const listener = vi.fn();
    const unsubscribe = controller.subscribe(listener);
    controller.fit();
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    controller.fit();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
