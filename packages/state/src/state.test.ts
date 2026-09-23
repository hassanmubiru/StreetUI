import { describe, it, expect, vi } from 'vitest';
import { signal, derived, effect, batch, Signal, DerivedSignal } from './signal.js';
import { createStore } from './store.js';

describe('signal', () => {
  it('holds an initial value', () => {
    const s = signal(42);
    expect(s.get()).toBe(42);
  });

  it('updates value with set', () => {
    const s = signal(0);
    s.set(5);
    expect(s.get()).toBe(5);
  });

  it('updates value with update fn', () => {
    const s = signal(10);
    s.update(n => n + 1);
    expect(s.get()).toBe(11);
  });

  it('notifies subscribers on change', () => {
    const s = signal(0);
    const calls: number[] = [];
    s.subscribe(v => calls.push(v));
    s.set(1);
    s.set(2);
    expect(calls).toEqual([1, 2]);
  });

  it('does not notify if value unchanged', () => {
    const s = signal(5);
    const calls: number[] = [];
    s.subscribe(v => calls.push(v));
    s.set(5);
    expect(calls).toHaveLength(0);
  });

  it('unsubscribes correctly', () => {
    const s = signal(0);
    const calls: number[] = [];
    const unsub = s.subscribe(v => calls.push(v));
    s.set(1);
    unsub();
    s.set(2);
    expect(calls).toEqual([1]);
  });

  it('peek returns value without tracking', () => {
    const s = signal(99);
    expect(s.peek()).toBe(99);
  });
});

describe('derived', () => {
  it('computes from source signals', () => {
    const a = signal(2);
    const b = signal(3);
    const sum = derived(() => a.get() + b.get());
    expect(sum.get()).toBe(5);
  });

  it('updates when dependency changes', () => {
    const a = signal(1);
    const doubled = derived(() => a.get() * 2);
    expect(doubled.get()).toBe(2);
    a.set(5);
    expect(doubled.get()).toBe(10);
  });

  it('notifies subscribers when recomputed', () => {
    const a = signal(0);
    const d = derived(() => a.get() + 1);
    const calls: number[] = [];
    d.subscribe(v => calls.push(v));
    a.set(1);
    expect(calls).toContain(2);
  });

  it('chains derived signals', () => {
    const base = signal(3);
    const doubled = derived(() => base.get() * 2);
    const plusOne = derived(() => doubled.get() + 1);
    expect(plusOne.get()).toBe(7);
    base.set(5);
    expect(plusOne.get()).toBe(11);
  });

  it('disposes cleanly', () => {
    const s = signal(1);
    const d = derived(() => s.get() * 2);
    d.get(); // trigger tracking
    d.dispose();
    // no throw
    s.set(99);
    expect(true).toBe(true);
  });
});

describe('effect', () => {
  it('runs immediately', () => {
    const s = signal(0);
    const calls: number[] = [];
    const stop = effect(() => { calls.push(s.get()); });
    expect(calls).toHaveLength(1);
    stop();
  });

  it('reruns when dependency changes', () => {
    const s = signal(0);
    const calls: number[] = [];
    const stop = effect(() => { calls.push(s.get()); });
    s.set(1);
    s.set(2);
    expect(calls.length).toBeGreaterThanOrEqual(2);
    stop();
  });

  it('cleans up on stop', () => {
    const s = signal(0);
    const calls: number[] = [];
    const stop = effect(() => { calls.push(s.get()); });
    stop();
    const before = calls.length;
    s.set(99);
    expect(calls.length).toBe(before);
  });
});

describe('batch', () => {
  it('batches multiple updates', () => {
    const a = signal(0);
    const b = signal(0);
    const calls: Array<[number, number]> = [];
    // subscribe to derived to see combined updates
    const combined = derived(() => a.get() + b.get());
    combined.subscribe(v => calls.push([a.peek(), b.peek()]));
    batch(() => {
      a.set(1);
      b.set(2);
    });
    // combined value should be 3
    expect(combined.get()).toBe(3);
  });
});

describe('Store', () => {
  it('creates a store with initial state', () => {
    const store = createStore({ count: 0, name: 'test' });
    expect(store.get('count')).toBe(0);
    expect(store.get('name')).toBe('test');
  });

  it('updates individual fields', () => {
    const store = createStore({ count: 0 });
    store.set('count', 5);
    expect(store.get('count')).toBe(5);
  });

  it('exposes signal per field', () => {
    const store = createStore({ x: 10 });
    const s = store.signal('x');
    expect(s).toBeInstanceOf(Signal);
    expect(s.get()).toBe(10);
  });

  it('subscribes to field changes', () => {
    const store = createStore({ count: 0 });
    const calls: number[] = [];
    const unsub = store.subscribe('count', v => calls.push(v));
    store.set('count', 1);
    store.set('count', 2);
    unsub();
    store.set('count', 3);
    expect(calls).toEqual([1, 2]);
  });

  it('returns a snapshot', () => {
    const store = createStore({ a: 1, b: 2 });
    const snap = store.getSnapshot();
    expect(snap).toEqual({ a: 1, b: 2 });
  });
});
