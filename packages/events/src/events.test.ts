import { describe, it, expect, vi } from 'vitest';
import { EventBus } from './event-bus.js';
import { createStreetEvent } from './event-types.js';
import { DomEventRegistry } from './dom-bridge.js';

describe('EventBus', () => {
  it('registers and dispatches events', () => {
    const bus = new EventBus();
    const calls: unknown[] = [];
    bus.on('click', e => calls.push(e.type));
    bus.emit(createStreetEvent('click', null));
    expect(calls).toEqual(['click']);
  });

  it('fires multiple handlers for same event', () => {
    const bus = new EventBus();
    let count = 0;
    bus.on('input', () => count++);
    bus.on('input', () => count++);
    bus.emit(createStreetEvent('input', null));
    expect(count).toBe(2);
  });

  it('off removes handler', () => {
    const bus = new EventBus();
    let count = 0;
    const h = () => count++;
    bus.on('click', h);
    bus.off('click', h);
    bus.emit(createStreetEvent('click', null));
    expect(count).toBe(0);
  });

  it('on returns unsubscribe fn', () => {
    const bus = new EventBus();
    let count = 0;
    const unsub = bus.on('click', () => count++);
    unsub();
    bus.emit(createStreetEvent('click', null));
    expect(count).toBe(0);
  });

  it('once fires only one time', () => {
    const bus = new EventBus();
    let count = 0;
    bus.once('submit', () => count++);
    bus.emit(createStreetEvent('submit', null));
    bus.emit(createStreetEvent('submit', null));
    expect(count).toBe(1);
  });

  it('clear removes all handlers for a type', () => {
    const bus = new EventBus();
    let count = 0;
    bus.on('click', () => count++);
    bus.clear('click');
    bus.emit(createStreetEvent('click', null));
    expect(count).toBe(0);
  });

  it('clear without type removes all handlers', () => {
    const bus = new EventBus();
    let count = 0;
    bus.on('click', () => count++);
    bus.on('input', () => count++);
    bus.clear();
    bus.emit(createStreetEvent('click', null));
    bus.emit(createStreetEvent('input', null));
    expect(count).toBe(0);
  });

  it('listenerCount returns correct count', () => {
    const bus = new EventBus();
    bus.on('click', () => {});
    bus.on('click', () => {});
    expect(bus.listenerCount('click')).toBe(2);
  });

  it('does not throw when emitting with no handlers', () => {
    const bus = new EventBus();
    expect(() => bus.emit(createStreetEvent('focus', null))).not.toThrow();
  });
});

describe('StreetEvent', () => {
  it('has correct type and timestamp', () => {
    const e = createStreetEvent('click', 'target');
    expect(e.type).toBe('click');
    expect(typeof e.timestamp).toBe('number');
  });

  it('preventDefault sets defaultPrevented', () => {
    const e = createStreetEvent('submit', null);
    expect(e.defaultPrevented).toBe(false);
    e.preventDefault();
    expect(e.defaultPrevented).toBe(true);
  });

  it('stopPropagation can be called without error', () => {
    const e = createStreetEvent('click', null);
    expect(() => e.stopPropagation()).not.toThrow();
  });

  it('carries optional data', () => {
    const e = createStreetEvent('input', null, { value: 'hello' });
    expect(e.data).toEqual({ value: 'hello' });
  });
});

describe('DomEventRegistry', () => {
  it('tracks binding count', () => {
    const registry = new DomEventRegistry();

    // Minimal EventTarget mock
    const listeners = new Map<string, EventListener[]>();
    const target = {
      addEventListener(type: string, fn: EventListener) {
        const list = listeners.get(type) ?? [];
        list.push(fn);
        listeners.set(type, list);
      },
      removeEventListener(type: string, fn: EventListener) {
        const list = listeners.get(type) ?? [];
        const idx = list.indexOf(fn);
        if (idx !== -1) list.splice(idx, 1);
      },
      dispatchEvent(_e: Event) { return true; },
    } as EventTarget;

    registry.bind(target, 'click', () => {});
    registry.bind(target, 'input', () => {});
    expect(registry.count).toBe(2);
  });

  it('removeAll clears all bindings', () => {
    const registry = new DomEventRegistry();
    const removed: string[] = [];
    const makeTarget = (name: string): EventTarget =>
      ({
        addEventListener() {},
        removeEventListener() { removed.push(name); },
        dispatchEvent(_e: Event) { return true; },
      }) as EventTarget;

    registry.bind(makeTarget('a'), 'click', () => {});
    registry.bind(makeTarget('b'), 'click', () => {});
    registry.removeAll();
    expect(removed).toEqual(['a', 'b']);
    expect(registry.count).toBe(0);
  });
});
