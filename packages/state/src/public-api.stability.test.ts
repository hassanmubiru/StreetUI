/**
 * v1.0 public API contract — @streetui/state.
 *
 * Imports ONLY the public barrel (never an internal path) and asserts the
 * frozen 1.0.0 export surface plus representative reactive behavior. A removal
 * or rename of any listed export is a semver-major break and fails here.
 */
import { describe, it, expect } from 'vitest';
import * as API from './index.js';
import {
  signal, derived, effect, batch, isBatching, signalKind, observerCount,
  createStore, Signal, DerivedSignal, Store, resource,
} from './index.js';

const FROZEN_VALUE_EXPORTS = [
  'batch', 'createStore', 'derived', 'DerivedSignal', 'effect', 'isBatching',
  'observerCount', 'resource', 'signal', 'Signal', 'signalKind', 'Store',
] as const;

describe('@streetui/state — public API contract (v1.0 frozen surface)', () => {
  it('exports every frozen public value', () => {
    for (const name of FROZEN_VALUE_EXPORTS) {
      expect(name in API, `missing public export: ${name}`).toBe(true);
      expect((API as Record<string, unknown>)[name]).toBeDefined();
    }
  });
});

describe('@streetui/state — reactive behavior stability', () => {
  it('signal get/set and update', () => {
    const s = signal(1);
    expect(s.get()).toBe(1);
    s.set(2);
    expect(s.get()).toBe(2);
    s.update((n) => n + 1);
    expect(s.get()).toBe(3);
    expect(s instanceof Signal).toBe(true);
  });

  it('derived recomputes from its sources', () => {
    const s = signal(2);
    const d = derived(() => s.get() * 10);
    expect(d.get()).toBe(20);
    s.set(3);
    expect(d.get()).toBe(30);
    expect(d instanceof DerivedSignal).toBe(true);
  });

  it('effect runs immediately and on dependency change, and disposes', () => {
    const s = signal('a');
    let seen = '';
    const stop = effect(() => { seen = s.get(); });
    expect(seen).toBe('a');
    s.set('b');
    expect(seen).toBe('b');
    stop();
    s.set('c');
    expect(seen).toBe('b'); // no longer observing after dispose
  });

  it('batch coalesces writes; isBatching reflects context', () => {
    const s = signal(0);
    expect(isBatching()).toBe(false);
    batch(() => {
      expect(isBatching()).toBe(true);
      s.set(1);
      s.set(2);
    });
    expect(s.get()).toBe(2);
    expect(isBatching()).toBe(false);
  });

  it('signalKind classifies writable vs derived; observerCount returns a number|undefined', () => {
    const s = signal(0);
    const d = derived(() => s.get());
    expect(signalKind(s)).toBe('writable');
    expect(signalKind(d)).toBe('derived');
    const oc = observerCount(s);
    expect(oc === undefined || typeof oc === 'number').toBe(true);
  });

  it('createStore yields a Store', () => {
    const store = createStore({ n: 1 });
    expect(store).toBeInstanceOf(Store);
  });

  it('resource is a factory function', () => {
    expect(typeof resource).toBe('function');
  });
});
