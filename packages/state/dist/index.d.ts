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
    /**
     * Called by the batch machinery after the batch has completed.
     * Notifies subscribers with the final coalesced value.
     */
    _flushBatch(value: unknown): void;
    private _flush;
    /**
     * @internal DevTools inspection only. The number of live observers
     * (direct subscribers plus derived/effect consumers). Read-only; never
     * mutates reactive state.
     */
    _observerCount(): number;
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
    /**
     * @internal DevTools inspection only. Live observers (subscribers plus
     * downstream consumers). Read-only.
     */
    _observerCount(): number;
}
declare function signal<T>(initial: T): Signal<T>;
declare function derived<T>(fn: () => T): DerivedSignal<T>;
declare function effect(fn: () => void | (() => void)): Unsubscribe;
/**
 * Run multiple signal updates as an atomic batch.
 *
 * Within the callback, calls to signal.set() are deferred — each signal
 * accumulates its latest value. When the outermost batch() returns,
 * each modified signal fires its subscribers exactly once with the final
 * value. Nested batch() calls are supported; the flush only runs when the
 * outermost batch exits.
 *
 * Example:
 *   batch(() => {
 *     count.set(1);
 *     count.set(2);
 *     count.set(3);
 *   });
 *   // subscribers see count = 3 exactly once
 */
declare function batch(fn: () => void): void;
/** True when inside a batch() call. Useful for advanced scheduling integration. */
declare function isBatching(): boolean;
/** Whether a signal is writable (`signal()`) or computed (`derived()`). */
type SignalKind = 'writable' | 'derived';
/** Classify a reactive value as writable or derived. */
declare function signalKind(source: ReadonlySignal<unknown>): SignalKind;
/**
 * The number of live observers on a signal — direct subscribers plus derived
 * or effect consumers — or `undefined` if the source does not expose the count.
 * Read-only; safe for DevTools. Never mutates reactive state.
 */
declare function observerCount(source: ReadonlySignal<unknown>): number | undefined;

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

/**
 * StreetUI async resources — framework-native asynchronous data.
 *
 * A `resource` wraps a Promise-returning loader and exposes its lifecycle as
 * ordinary StreetUI signals (status / data / error), so it composes with
 * `derived`, `effect`, `when()`, `listOf` and the renderer with no second
 * reactive system.
 *
 * State machine:
 *
 *   idle ──(load)──▶ loading ──(resolve)──▶ success
 *                      │
 *                      └────(reject)──────▶ error
 *
 * Refetch keeps the previously-loaded `data` visible while `status` is
 * `'loading'` again (see `isRefetching`) — there is no separate `'refetching'`
 * status; it is expressed through `status === 'loading'` with `data` still set.
 *
 * The resource is transport-agnostic: the loader is any function returning a
 * value or a Promise. When it accepts the provided `AbortSignal`, in-flight
 * work is cancelled on `dispose()` or when a newer request supersedes it.
 */

type ResourceStatus = 'idle' | 'loading' | 'success' | 'error';
/** Context handed to the loader; carries an AbortSignal for cancellation. */
interface ResourceLoaderContext {
    readonly signal: AbortSignal;
}
/** Any value-or-Promise producing function. Receives an abort-aware context. */
type ResourceLoader<T> = (ctx: ResourceLoaderContext) => Promise<T> | T;
interface ResourceOptions<T = unknown> {
    /** Load immediately on creation. Defaults to `true`. When `false`, stays `idle` until `refetch()`. */
    readonly immediate?: boolean;
    /**
     * Explicit reactive dependencies. When any listed signal changes, the
     * resource refetches. Dependencies are explicit (not auto-tracked from the
     * loader body) so there is no risk of an accidental infinite refetch loop.
     */
    readonly watch?: ReadonlyArray<ReadonlySignal<unknown>>;
    /**
     * Optional teardown registrar (e.g. a route's `ctx.onCleanup`). When given,
     * the resource registers its own `dispose` so it is cleaned up automatically
     * when its owner is removed.
     */
    readonly onCleanup?: (fn: () => void) => void;
    /**
     * Server-provided initial value for hydration. When present the resource
     * starts in `'success'` with this data already visible, and the initial
     * auto-load is skipped (so the client does not refetch data the server
     * already resolved). This is the client half of SSR resource transfer; the
     * server side awaits `refetch()` before serializing. Set `immediate: true`
     * explicitly to force a client refetch anyway.
     */
    readonly initialData?: T;
    /** Server-provided initial error for hydration (mirrors `initialData`). */
    readonly initialError?: unknown;
    /**
     * Explicit initial status override. Rarely needed — inferred as `'success'`
     * from `initialData` or `'error'` from `initialError`.
     */
    readonly initialStatus?: ResourceStatus;
}
interface Resource<T> {
    /** Reactive lifecycle status. */
    readonly status: ReadonlySignal<ResourceStatus>;
    /** The last successfully-loaded value, or `undefined` before first success. */
    readonly data: ReadonlySignal<T | undefined>;
    /** The most recent error, or `undefined` when there is none. Typed `unknown` — never `any`. */
    readonly error: ReadonlySignal<unknown>;
    /** Convenience: `status === 'loading'`. */
    readonly loading: ReadonlySignal<boolean>;
    /** Convenience: loading while previously-loaded data is still present (a refetch). */
    readonly isRefetching: ReadonlySignal<boolean>;
    /** Trigger a new request. Resolves when the request settles (or is superseded). */
    refetch(): Promise<void>;
    /** Cancel in-flight work, drop watchers, and ignore any late results. Idempotent. */
    dispose(): void;
}
declare function resource<T>(loader: ResourceLoader<T>, options?: ResourceOptions<T>): Resource<T>;

export { DerivedSignal, type ReactiveConsumer, type ReactiveSource, type ReadonlySignal, type Resource, type ResourceLoader, type ResourceLoaderContext, type ResourceOptions, type ResourceStatus, Signal, type SignalKind, Store, type StoreState, type Subscriber, type Unsubscribe, batch, createStore, derived, effect, isBatching, observerCount, resource, signal, signalKind };
