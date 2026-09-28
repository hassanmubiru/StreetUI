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

/**
 * StreetUI mutations — framework-native asynchronous *writes*.
 *
 * A `resource` models a read: a loader that runs on creation / on demand and
 * whose value the UI observes. A `mutation` is its write-side counterpart: an
 * explicit, argument-taking async action (create / update / delete, a form
 * submit, a "mark as done" click) whose lifecycle is exposed as ordinary
 * StreetUI signals so it composes with `derived`, `when()`, and the renderer
 * with NO second reactive system.
 *
 * State machine (mirrors `resource`, but only ever advances on an explicit
 * `mutate()` — a mutation never runs on its own):
 *
 *   idle ──(mutate)──▶ loading ──(resolve)──▶ success
 *                        │
 *                        └────(reject)──────▶ error
 *
 * There is deliberately NO global cache and NO automatic invalidation registry
 * (that would be a second state system with its own lifetime and coherency
 * rules). Invalidation is explicit and local: pass an `onSuccess` that calls the
 * `refetch()` of whichever resources the write affected. This keeps data flow
 * one-directional and readable — the write says exactly what it invalidates.
 */

/** A mutation shares the resource status vocabulary (idle/loading/success/error). */
type MutationStatus = ResourceStatus;
/** The async action a mutation runs. Receives the caller's argument. */
type Mutator<TArgs, TResult> = (args: TArgs) => Promise<TResult> | TResult;
interface MutationOptions<TArgs, TResult> {
    /**
     * Run after a successful mutation, before `mutate()`'s promise resolves. The
     * natural place to invalidate reads: call the affected resources' `refetch()`.
     * May be async; its completion is awaited so callers can rely on reads being
     * up to date once `mutate()` resolves.
     */
    readonly onSuccess?: (result: TResult, args: TArgs) => void | Promise<void>;
    /** Run after a failed mutation (the thrown value is passed through). */
    readonly onError?: (error: unknown, args: TArgs) => void | Promise<void>;
    /** Run after success OR error, once the lifecycle has settled. */
    readonly onSettled?: (args: TArgs) => void | Promise<void>;
    /**
     * Optional teardown registrar (e.g. a component's `ctx.onCleanup`). When
     * given, the mutation registers its own `dispose` so late results from an
     * in-flight `mutate()` are ignored once the owner is removed.
     */
    readonly onCleanup?: (fn: () => void) => void;
}
interface Mutation<TArgs, TResult> {
    /** Reactive lifecycle status. */
    readonly status: ReadonlySignal<MutationStatus>;
    /** The most recent successful result, or `undefined` before first success. */
    readonly data: ReadonlySignal<TResult | undefined>;
    /** The most recent error, or `undefined` when there is none. Typed `unknown`. */
    readonly error: ReadonlySignal<unknown>;
    /** Convenience: `status === 'loading'` (an in-flight write). */
    readonly pending: ReadonlySignal<boolean>;
    /**
     * Run the mutation. Resolves with the result on success. On failure the
     * rejection is surfaced through `error`/`status` AND re-thrown, so a caller
     * that wants to react imperatively can `try/catch`; a caller that only wants
     * the reactive state can ignore the returned promise. Superseded/disposed
     * runs never write state (race guard), matching `resource`.
     */
    mutate(args: TArgs): Promise<TResult>;
    /** Reset back to `idle` with no data/error. */
    reset(): void;
    /** Ignore any in-flight result and mark the mutation inert. Idempotent. */
    dispose(): void;
}
/**
 * Create a {@link Mutation}. The zero-argument form is written
 * `mutation<void, T>(() => …)` and invoked as `mutate(undefined)`.
 */
declare function mutation<TArgs, TResult>(mutator: Mutator<TArgs, TResult>, options?: MutationOptions<TArgs, TResult>): Mutation<TArgs, TResult>;

/**
 * Optional HTTP data client (2.0 §17) — the integration path between StreetUI's
 * transport-agnostic `resource`/`mutation` primitives and a real backend (a
 * StreetJS server, or any HTTP/JSON API).
 *
 * This is deliberately OPTIONAL and dependency-free: it imports nothing from
 * StreetJS (or any server framework), so StreetUI's core stays independent — an
 * app that never calls `createClient` never pays for it, and StreetUI does not
 * take on a backend dependency. It is a thin, honest convenience over the
 * standard `fetch`: URL joining, JSON encode/decode, header merging, abort
 * propagation, and a typed error. All state still flows through the existing
 * `resource`/`mutation` signals — there is no cache and no second data system.
 *
 * ```ts
 * const api = createClient({ baseUrl: '/api' });
 * const users = api.resource<User[]>('/users');            // a read
 * const create = api.mutation<NewUser, User>('POST', '/users', {
 *   onSuccess: () => users.refetch(),                      // explicit invalidation
 * });
 * ```
 */

/** A `fetch`-compatible function. Injectable for tests / non-browser runtimes. */
type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
interface ClientConfig {
    /** Prefix joined to every request path (e.g. `/api` or `https://x/api`). */
    readonly baseUrl?: string;
    /** Headers merged into every request (per-request headers win). */
    readonly headers?: Readonly<Record<string, string>>;
    /**
     * The fetch implementation to use. Defaults to the global `fetch`. Injecting
     * one keeps the client testable and usable where no global fetch exists.
     */
    readonly fetch?: FetchLike;
}
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
interface RequestConfig {
    /** Extra headers for this request (merged over the client's). */
    readonly headers?: Readonly<Record<string, string>>;
    /** Abort signal — pass a resource/mutation loader's `ctx.signal` for cancellation. */
    readonly signal?: AbortSignal;
    /** Query parameters appended to the URL. */
    readonly query?: Readonly<Record<string, string | number | boolean>>;
}
/**
 * A failed HTTP response (non-2xx). Carries the status and the parsed body when
 * one was returned. NOTE: the body may contain server-supplied detail; the §7
 * error reporter never enumerates an error's own-properties, so `HttpError.body`
 * never leaks into a diagnostics report unless an app deliberately reads it.
 */
declare class HttpError extends Error {
    readonly status: number;
    readonly statusText: string;
    readonly url: string;
    readonly body: unknown;
    constructor(status: number, statusText: string, url: string, body: unknown);
}
interface Client {
    /** Issue a request and return the parsed JSON body (throws `HttpError` on non-2xx). */
    request<T>(method: HttpMethod, path: string, body?: unknown, config?: RequestConfig): Promise<T>;
    get<T>(path: string, config?: RequestConfig): Promise<T>;
    post<T>(path: string, body?: unknown, config?: RequestConfig): Promise<T>;
    put<T>(path: string, body?: unknown, config?: RequestConfig): Promise<T>;
    patch<T>(path: string, body?: unknown, config?: RequestConfig): Promise<T>;
    del<T>(path: string, config?: RequestConfig): Promise<T>;
    /**
     * A GET-backed {@link Resource}. The loader forwards the resource's abort
     * signal, so `dispose()`/supersede cancels the request.
     */
    resource<T>(path: string, options?: ResourceOptions<T> & {
        readonly query?: RequestConfig['query'];
    }): Resource<T>;
    /**
     * A {@link Mutation} that issues `method path` with the mutate() argument as
     * the JSON body. Pair with `onSuccess` to refetch affected resources.
     */
    mutation<TArgs, TResult>(method: HttpMethod, path: string, options?: MutationOptions<TArgs, TResult>): Mutation<TArgs, TResult>;
}
/** Create an optional HTTP data client. Uses global `fetch` unless one is injected. */
declare function createClient(config?: ClientConfig): Client;

/**
 * Optional auth session primitive (2.0 §19) — reactive authentication state for
 * building sign-in UIs and protected routes, composed entirely from the existing
 * `resource` (the "who am I" read) and `mutation` (logout / refresh writes).
 *
 * There is no new auth framework here and no credential handling: the app
 * supplies a `loadUser` function (however it authenticates — a StreetJS session
 * cookie, a bearer token, anything) that returns the current user or `null`. The
 * primitive turns that into the states a UI switches on — `loading`,
 * `authenticated`, `unauthenticated`, `error` — plus `refresh()` and `logout()`.
 *
 * How the pieces the spec names fit together (all EXISTING seams, no new ones):
 *   - loading / unauth / auth  → switch UI with `when(session.authenticated, …)`
 *     etc. (the renderer's existing conditional).
 *   - refresh / logout         → `session.refresh()` / `session.logout()`.
 *   - protected route          → in a route's setup, read `session.status`; when
 *     `unauthenticated`, navigate to the login route (router). Throwing inside a
 *     guarded builder is caught by `errorBoundary` for an error fallback. This
 *     module stays router-agnostic so core has no router dependency — the app
 *     wires the navigation, exactly as with any other signal.
 */

/** The four states an auth-aware UI switches on. */
type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'error';
/** Load the current user, or `null`/`undefined` when nobody is signed in. */
type LoadUser<TUser> = (ctx: ResourceLoaderContext) => Promise<TUser | null | undefined> | TUser | null | undefined;
interface AuthSessionConfig<TUser> {
    /** Resolve the current user (or null when unauthenticated). Abort-aware. */
    readonly loadUser: LoadUser<TUser>;
    /**
     * Perform the server-side logout (clear the cookie/token). Optional — when
     * omitted, `logout()` just re-checks the session. After it resolves the
     * session refreshes, so `loadUser` should then return null.
     */
    readonly logout?: () => Promise<void> | void;
    /** Skip the initial load; stays `loading` until the first `refresh()`. */
    readonly immediate?: boolean;
    /** Teardown registrar (e.g. a component's `ctx.onCleanup`). */
    readonly onCleanup?: (fn: () => void) => void;
}
interface AuthSession<TUser> {
    /** The current coarse auth state. */
    readonly status: ReadonlySignal<AuthStatus>;
    /** The signed-in user, or `undefined` when not authenticated. */
    readonly user: ReadonlySignal<TUser | undefined>;
    /** The most recent load/logout error, or `undefined`. */
    readonly error: ReadonlySignal<unknown>;
    /** `status === 'authenticated'`. */
    readonly authenticated: ReadonlySignal<boolean>;
    /** `status === 'unauthenticated'`. */
    readonly unauthenticated: ReadonlySignal<boolean>;
    /** `status === 'loading'` (the initial who-am-I is still in flight). */
    readonly loading: ReadonlySignal<boolean>;
    /** True while a `logout()` is in flight. */
    readonly loggingOut: ReadonlySignal<boolean>;
    /** Re-run `loadUser` (e.g. after a token refresh or a focus regain). */
    refresh(): Promise<void>;
    /** Run the configured server logout, then refresh (→ unauthenticated). */
    logout(): Promise<void>;
    /** Cancel in-flight work and detach. Idempotent. */
    dispose(): void;
}
/**
 * Create an {@link AuthSession}. The session starts in `loading` and resolves to
 * `authenticated`/`unauthenticated` once `loadUser` settles (unless
 * `immediate: false`).
 */
declare function createAuthSession<TUser>(config: AuthSessionConfig<TUser>): AuthSession<TUser>;

export { type AuthSession, type AuthSessionConfig, type AuthStatus, type Client, type ClientConfig, DerivedSignal, type FetchLike, HttpError, type HttpMethod, type LoadUser, type Mutation, type MutationOptions, type MutationStatus, type Mutator, type ReactiveConsumer, type ReactiveSource, type ReadonlySignal, type RequestConfig, type Resource, type ResourceLoader, type ResourceLoaderContext, type ResourceOptions, type ResourceStatus, Signal, type SignalKind, Store, type StoreState, type Subscriber, type Unsubscribe, batch, createAuthSession, createClient, createStore, derived, effect, isBatching, mutation, observerCount, resource, signal, signalKind };
