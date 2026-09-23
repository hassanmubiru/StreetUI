/**
 * A simple reactive store built on top of signals.
 * Useful for structured state with multiple fields.
 */

import { Signal, signal, type Subscriber, type Unsubscribe } from './signal.js';

export type StoreState = Record<string, unknown>;

export class Store<T extends StoreState> {
  private readonly _signals: Record<string, Signal<unknown>>;

  constructor(initial: T) {
    const signals: Record<string, Signal<unknown>> = {};
    for (const key in initial) {
      if (Object.prototype.hasOwnProperty.call(initial, key)) {
        signals[key] = signal(initial[key] as unknown);
      }
    }
    this._signals = signals;
  }

  get<K extends keyof T>(key: K): T[K] {
    const s = this._signals[key as string];
    if (s === undefined) {
      throw new Error(`Store: unknown key "${String(key)}"`);
    }
    return s.get() as T[K];
  }

  set<K extends keyof T>(key: K, value: T[K]): void {
    const s = this._signals[key as string];
    if (s === undefined) {
      throw new Error(`Store: unknown key "${String(key)}"`);
    }
    s.set(value as unknown);
  }

  signal<K extends keyof T>(key: K): Signal<T[K]> {
    const s = this._signals[key as string];
    if (s === undefined) {
      throw new Error(`Store: unknown key "${String(key)}"`);
    }
    return s as unknown as Signal<T[K]>;
  }

  subscribe<K extends keyof T>(key: K, fn: Subscriber<T[K]>): Unsubscribe {
    return this.signal(key).subscribe(fn);
  }

  getSnapshot(): T {
    const snap = {} as T;
    for (const key in this._signals) {
      if (Object.prototype.hasOwnProperty.call(this._signals, key)) {
        (snap as Record<string, unknown>)[key] = this._signals[key]?.peek();
      }
    }
    return snap;
  }
}

export function createStore<T extends StoreState>(initial: T): Store<T> {
  return new Store(initial);
}
