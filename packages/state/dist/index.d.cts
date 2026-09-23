/**
 * StreetUI reactive signals — framework-owned reactivity, no external libraries.
 *
 * Architecture:
 *   Signal<T>        — writable, holds a value, notifies on change
 *   DerivedSignal<T> — read-only, lazily computed from other signals
 *   effect()         — side-effect that re-runs when dependencies change
 *   batch()          — run multiple updates before notifying
 */
type Subscriber<T> = (value: T) => void;
type Unsubscribe = () => void;
/**
 * Any reactive source that can have downstream consumers attached.
 * Both Signal and DerivedSignal implement this.
 */
interface ReactiveSource<T> {
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
interface ReactiveConsumer {
    _invalidate(): void;
    /** Internal: called by a source to register a dependency. */
    _addSource(src: ReactiveSource<unknown>): void;
}
interface ReadonlySignal<T> {
    get(): T;
    peek(): T;
    subscribe(fn: Subscriber<T>): Unsubscribe;
}
declare class Signal<T> implements ReactiveSource<T>, ReadonlySignal<T> {
    protected _value: T;
    private readonly _subscribers;
    private readonly _consumers;
    constructor(initial: T);
    get(): T;
    peek(): T;
    set(value: T): void;
    update(fn: (current: T) => T): void;
    subscribe(fn: Subscriber<T>): Unsubscribe;
    _removeConsumer(consumer: ReactiveConsumer): void;
    private _flush;
}
declare class DerivedSignal<T> implements ReactiveSource<T>, ReactiveConsumer, ReadonlySignal<T> {
    private _value;
    private _dirty;
    private _disposed;
    private readonly _fn;
    private readonly _subscribers;
    /** All upstream sources this derived currently reads from. */
    private readonly _sources;
    /** Downstream consumers that depend on this derived. */
    private readonly _consumers;
    constructor(fn: () => T);
    get(): T;
    peek(): T;
    subscribe(fn: Subscriber<T>): Unsubscribe;
    _addSource(src: ReactiveSource<unknown>): void;
    _removeConsumer(consumer: ReactiveConsumer): void;
    _invalidate(): void;
    private _recompute;
    dispose(): void;
}
declare function signal<T>(initial: T): Signal<T>;
declare function derived<T>(fn: () => T): DerivedSignal<T>;
declare function effect(fn: () => void | (() => void)): Unsubscribe;
declare function batch(fn: () => void): void;

/**
 * A simple reactive store built on top of signals.
 * Useful for structured state with multiple fields.
 */

type StoreState = Record<string, unknown>;
declare class Store<T extends StoreState> {
    private readonly _signals;
    constructor(initial: T);
    get<K extends keyof T>(key: K): T[K];
    set<K extends keyof T>(key: K, value: T[K]): void;
    signal<K extends keyof T>(key: K): Signal<T[K]>;
    subscribe<K extends keyof T>(key: K, fn: Subscriber<T[K]>): Unsubscribe;
    getSnapshot(): T;
}
declare function createStore<T extends StoreState>(initial: T): Store<T>;

export { DerivedSignal, type ReactiveConsumer, type ReactiveSource, type ReadonlySignal, Signal, Store, type StoreState, type Subscriber, type Unsubscribe, batch, createStore, derived, effect, signal };
