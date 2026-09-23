/**
 * StreetUI reactive signals — framework-owned reactivity, no external libraries.
 *
 * Architecture:
 *   Signal<T>        — writable, holds a value, notifies on change
 *   DerivedSignal<T> — read-only, lazily computed from other signals
 *   effect()         — side-effect that re-runs when dependencies change
 *   batch()          — run multiple updates before notifying
 */

export type Subscriber<T> = (value: T) => void;
export type Unsubscribe = () => void;

// ── Tracking ──────────────────────────────────────────────────────────────────

/**
 * Any reactive source that can have downstream consumers attached.
 * Both Signal and DerivedSignal implement this.
 */
export interface ReactiveSource<T> {
  get(): T;
  peek(): T;
  subscribe(fn: Subscriber<T>): Unsubscribe;
  /** Internal: remove a downstream consumer. */
  _removeConsumer(consumer: ReactiveConsumer): void;
}

/**
 * A downstream consumer (DerivedSignal or Effect) that can be invalidated
 * and can register itself as depending on a source.
 */
export interface ReactiveConsumer {
  _invalidate(): void;
  /** Internal: called by a source to register a dependency. */
  _addSource(src: ReactiveSource<unknown>): void;
}

/** The active consumer being tracked during a computation. */
let _activeConsumer: ReactiveConsumer | null = null;

function withConsumer<T>(consumer: ReactiveConsumer, fn: () => T): T {
  const prev = _activeConsumer;
  _activeConsumer = consumer;
  try {
    return fn();
  } finally {
    _activeConsumer = prev;
  }
}

// ── Signal ────────────────────────────────────────────────────────────────────

export interface ReadonlySignal<T> {
  get(): T;
  peek(): T;
  subscribe(fn: Subscriber<T>): Unsubscribe;
}

export class Signal<T> implements ReactiveSource<T>, ReadonlySignal<T> {
  protected _value: T;
  private readonly _subscribers: Set<Subscriber<T>> = new Set();
  private readonly _consumers: Set<ReactiveConsumer> = new Set();

  constructor(initial: T) {
    this._value = initial;
  }

  get(): T {
    if (_activeConsumer !== null) {
      this._consumers.add(_activeConsumer);
      _activeConsumer._addSource(this as ReactiveSource<unknown>);
    }
    return this._value;
  }

  peek(): T {
    return this._value;
  }

  set(value: T): void {
    if (Object.is(this._value, value)) return;
    this._value = value;
    this._flush(value);
  }

  update(fn: (current: T) => T): void {
    this.set(fn(this._value));
  }

  subscribe(fn: Subscriber<T>): Unsubscribe {
    this._subscribers.add(fn);
    return () => { this._subscribers.delete(fn); };
  }

  _removeConsumer(consumer: ReactiveConsumer): void {
    this._consumers.delete(consumer);
  }

  private _flush(value: T): void {
    for (const sub of [...this._subscribers]) sub(value);
    for (const consumer of [...this._consumers]) consumer._invalidate();
  }
}

// ── DerivedSignal ─────────────────────────────────────────────────────────────

export class DerivedSignal<T> implements ReactiveSource<T>, ReactiveConsumer, ReadonlySignal<T> {
  private _value: T | undefined = undefined;
  private _dirty = true;
  private _disposed = false;
  private readonly _fn: () => T;
  private readonly _subscribers: Set<Subscriber<T>> = new Set();
  /** All upstream sources this derived currently reads from. */
  private readonly _sources: Set<ReactiveSource<unknown>> = new Set();
  /** Downstream consumers that depend on this derived. */
  private readonly _consumers: Set<ReactiveConsumer> = new Set();

  constructor(fn: () => T) {
    this._fn = fn;
  }

  get(): T {
    // Register this derived with the outer consumer if any
    if (_activeConsumer !== null) {
      this._consumers.add(_activeConsumer);
      _activeConsumer._addSource(this as ReactiveSource<unknown>);
    }
    if (this._dirty) this._recompute();
    return this._value as T;
  }

  peek(): T {
    if (this._dirty) this._recompute();
    return this._value as T;
  }

  subscribe(fn: Subscriber<T>): Unsubscribe {
    // Eagerly compute so sources track this derived as a consumer
    if (this._dirty) this._recompute();
    this._subscribers.add(fn);
    return () => { this._subscribers.delete(fn); };
  }

  _addSource(src: ReactiveSource<unknown>): void {
    this._sources.add(src);
  }

  _removeConsumer(consumer: ReactiveConsumer): void {
    this._consumers.delete(consumer);
  }

  _invalidate(): void {
    if (this._disposed) return;
    this._dirty = true;
    const newVal = this.peek(); // recompute
    for (const sub of [...this._subscribers]) sub(newVal);
    for (const consumer of [...this._consumers]) consumer._invalidate();
  }

  private _recompute(): void {
    // Detach from all current sources before re-tracking
    for (const src of this._sources) src._removeConsumer(this);
    this._sources.clear();

    this._value = withConsumer(this, this._fn);
    this._dirty = false;
  }

  dispose(): void {
    this._disposed = true;
    for (const src of this._sources) src._removeConsumer(this);
    this._sources.clear();
    this._subscribers.clear();
    this._consumers.clear();
  }
}

// ── effect ────────────────────────────────────────────────────────────────────

class Effect implements ReactiveConsumer {
  private readonly _fn: () => void | (() => void);
  private _cleanup: (() => void) | undefined = undefined;
  private _disposed = false;
  private readonly _sources: Set<ReactiveSource<unknown>> = new Set();

  constructor(fn: () => void | (() => void)) {
    this._fn = fn;
    this._run();
  }

  _addSource(src: ReactiveSource<unknown>): void {
    this._sources.add(src);
  }

  _invalidate(): void {
    if (this._disposed) return;
    this._run();
  }

  private _run(): void {
    // Detach from all current sources before re-tracking
    for (const src of this._sources) src._removeConsumer(this);
    this._sources.clear();

    if (typeof this._cleanup === 'function') this._cleanup();
    const result = withConsumer(this, this._fn);
    this._cleanup = typeof result === 'function' ? result : undefined;
  }

  dispose(): void {
    this._disposed = true;
    for (const src of this._sources) src._removeConsumer(this);
    this._sources.clear();
    if (typeof this._cleanup === 'function') this._cleanup();
    this._cleanup = undefined;
  }
}

// ── Public factories ──────────────────────────────────────────────────────────

export function signal<T>(initial: T): Signal<T> {
  return new Signal(initial);
}

export function derived<T>(fn: () => T): DerivedSignal<T> {
  return new DerivedSignal(fn);
}

export function effect(fn: () => void | (() => void)): Unsubscribe {
  const e = new Effect(fn);
  return () => e.dispose();
}

export function batch(fn: () => void): void {
  // Signals notify synchronously; batch is a no-op in this implementation.
  // A queuing batch would require a global pending-notifications list,
  // which adds complexity without benefit for the current scheduler integration.
  fn();
}
