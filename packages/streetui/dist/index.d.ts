import { c as Signal, d as Subscriber, U as Unsubscribe, R as ReadonlySignal, e as ResourceStatus, f as ResourceOptions, g as Resource, h as ResourceLoaderContext, A as ApplicationId, D as DiagnosticCollector, i as ApplicationGraph, G as GraphNode, C as CompiledApplication, j as HydrationDiagnosticSink, k as SemanticNodeType, P as PageDSL, T as TransitionConfig, l as ContainerDSL, m as SignalKind } from './hydration-diagnostics-Bh0-5vdC.js';
export { n as A11yOptions, o as AppBuilder, p as AppDSL, q as AppOptions, r as ApplicationGraphOptions, s as AsyncBoundaryBranches, B as BaseNode, t as Bindable, u as BindableString, v as BindableText, w as BoundInputOptions, x as ButtonOptions, y as CodeOptions, z as CompileOptions, b as ComponentChildren, E as ComponentContext, a as ComponentDefinition, F as ComponentRender, I as ComponentSetup, b as ContainerBuilder, J as ContainerBuilderImpl, K as ContainerOptions, L as ContentDSL, M as ControlledInputOptions, N as DerivedSignal, O as Diagnostic, Q as DiagnosticError, W as DiagnosticLocation, X as DiagnosticSeverity, Y as ErrorBoundaryOptions, Z as ErrorFallbackBuilder, _ as ErrorSource, $ as EventDescriptor, a0 as FormBuilder, a1 as FormBuilderImpl, a2 as FormDSL, a3 as FormOptions, a4 as GraphNodeData, a5 as HandlerFn, a6 as HeadContribution, a7 as HeadEntry, a8 as HeadMetadata, a9 as HeadingOptions, H as HydrationDiagnostic, aa as HydrationMismatchType, ab as ImageOptions, ac as InputOptions, ad as InputOptionsBase, ae as LinkDescriptor, af as LinkOptions, ag as ListBuilder, ah as ListBuilderImpl, ai as ListDSL, aj as ListOptions, ak as ListPlanEntry, al as MetaDescriptor, am as NodeId, an as NodeMetadata, ao as OverlayOptions, ap as PageBuilder, aq as PageBuilderImpl, ar as PortalOptions, as as PropValue, at as Props, au as ReactiveConsumer, av as ReactiveSource, aw as ResolvedTransition, ax as ResourceLoader, ay as SectionBuilder, az as SectionBuilderImpl, aA as SectionDSL, aB as SectionOptions, aC as SerializedGraph, aD as SerializedNode, aE as StateRef, S as StreetApp, aF as StreetUI, aG as TextOptions, aH as TextValue, V as VERSION, aI as WhenOptions, aJ as batch, aK as compile, aL as compileGraph, aM as component, aN as consoleHydrationDiagnosticSink, aO as createHydrationDiagnosticCollector, aP as createNodeId, aQ as derived, aR as effect, aS as formatDiagnostic, aT as formatHydrationDiagnostic, aU as generateApplicationId, aV as generateNodeId, aW as isBatching, aX as isComponentDefinition, aY as isHeadContribution, aZ as isTransitionConfig, a_ as nextId, a$ as nodeIdPrefix, b0 as observerCount, b1 as reactiveListItemKey, b2 as reactiveListItemSignature, b3 as resetIdCounter, b4 as resolveHead, b5 as resolveTransition, b6 as resource, b7 as signal, b8 as signalKind, b9 as streetui } from './hydration-diagnostics-Bh0-5vdC.js';
import { L as Lifecycle, C as CleanupRegistry, D as DOMAdapter, N as NodeInstance, R as RenderContext } from './server-CzcNNC9F.js';
export { H as HeadManager, a as LifecycleHook, b as LifecyclePhase, c as RenderToStringOptions, S as STATE_MARKER_ATTR, d as ServerDOMAdapter, e as createRenderContext, r as readState, f as renderHead, g as renderToString, s as serializeState, h as serverDOMAdapter, w as wireHeadBehavior } from './server-CzcNNC9F.js';
import { R as RenderHandle, S as StreetRenderer } from './renderer-interface-BOpzkWWQ.js';

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

/**
 * Deterministic accessibility id helpers.
 *
 * Accessible markup often needs stable id relationships — a `<label for>` (or
 * `aria-labelledby`) pointing at an input, an `aria-describedby` pointing at a
 * hint/error, an `aria-labelledby` on a dialog pointing at its title. Those ids
 * must be IDENTICAL on the server and the client, otherwise a hydrated subtree
 * that re-renders (e.g. a toggled `when()` branch) would compute a different id
 * than the server emitted and break the association.
 *
 * These helpers derive ids purely from a caller-supplied stable base string
 * (typically a form field name or a dialog name). They use NO incrementing
 * counter and NO randomness, so `a11yIds('email')` yields the same ids in every
 * environment and on every call — which is exactly what SSR + hydration needs.
 */
/** Normalise an arbitrary base into a token safe for use in an id/selector. */
declare function toIdToken(base: string): string;
interface A11yIds {
    /** The normalised base token. */
    readonly base: string;
    /** Id for the primary interactive element (e.g. the input). */
    readonly input: string;
    /** Id for a label element / labelling text (target of `aria-labelledby`). */
    readonly label: string;
    /** Id for descriptive/help text (target of `aria-describedby`). */
    readonly description: string;
    /** Id for an error message element. */
    readonly error: string;
    /** Id for a title element (e.g. a dialog title; target of `aria-labelledby`). */
    readonly title: string;
    /**
     * Id for a control that triggers a popup (button/summary). Pair with
     * `controls` on the popup it opens (`ariaControls: ids.controls`,
     * `ariaExpanded: open`).
     */
    readonly trigger: string;
    /** Id for a popup/region a `trigger` controls (target of `aria-controls`). */
    readonly controls: string;
    /** Id for a subtree owned out-of-DOM-order (target of `aria-owns`). */
    readonly owns: string;
    /** Derive an arbitrary suffixed id from the same base. */
    id(suffix: string): string;
}
/**
 * Build a set of deterministic, SSR-stable ids from a base string.
 *
 * @example
 * const ids = a11yIds('email');
 * // ids.input === 'email-input', ids.label === 'email-label', ...
 * input({ bind: value, id: ids.input, ariaLabelledBy: ids.label, ariaDescribedBy: ids.error });
 * text('Email', { id: ids.label });
 *
 * @example
 * // A menu button that controls its popup, wired by shared ids:
 * const m = a11yIds('actions');
 * button('Actions', { id: m.trigger, ariaControls: m.controls, ariaExpanded: open });
 * page.dropdown('menu', { open, id: m.controls }, (d) => { … });
 */
declare function a11yIds(base: string): A11yIds;

/**
 * Environment detection and capability flags.
 * The framework behaves slightly differently in browser vs. server vs. test.
 *
 * We use `typeof` checks throughout to remain safe across environments
 * without depending on @types/node.
 */
type EnvironmentKind = 'browser' | 'server' | 'worker' | 'test' | 'unknown';
interface EnvironmentCapabilities {
    readonly hasDom: boolean;
    readonly hasWindow: boolean;
    readonly hasDocument: boolean;
    readonly isSecureContext: boolean;
}
declare class Environment {
    readonly kind: EnvironmentKind;
    readonly capabilities: EnvironmentCapabilities;
    constructor(kind?: EnvironmentKind);
    get isBrowser(): boolean;
    get isServer(): boolean;
    get isTest(): boolean;
    get isWorker(): boolean;
}
/** The singleton environment for this execution context. */
declare const environment: Environment;

/**
 * Top-level Application primitive.
 * Owns lifecycle, identity, and the root of the application graph.
 */

interface ApplicationOptions {
    readonly name: string;
    readonly version?: string;
    readonly environment?: Environment;
}
declare class Application {
    readonly id: ApplicationId;
    readonly name: string;
    readonly version: string;
    readonly lifecycle: Lifecycle;
    readonly cleanup: CleanupRegistry;
    readonly diagnostics: DiagnosticCollector;
    readonly environment: Environment;
    constructor(options: ApplicationOptions);
    mount(): Promise<void>;
    unmount(): Promise<void>;
    onMount(fn: () => void | Promise<void>): void;
    onUnmount(fn: () => void | Promise<void>): void;
}
/** Factory convenience wrapper. */
declare function createApplication(options: ApplicationOptions): Application;

/**
 * Observability boundary — a tiny, optional logging seam plus contextual
 * framework errors.
 *
 * StreetUI never ships a telemetry service, never sends anything over the
 * network, and never logs on its own by default. Instead an application MAY
 * hand the framework a `DiagnosticSink` — any object with the log methods it
 * cares about — and the framework will route the diagnostics it already
 * produces (runtime errors, resource failures, hydration mismatches, router
 * transitions) to it. With no sink attached there is no logging and no cost.
 *
 * This is deliberately smaller than a logging library: it duplicates neither
 * `console` nor any structured-diagnostic type. It is a boundary, not a logger.
 */
/**
 * Where a framework diagnostic originated. Every field is optional so a caller
 * supplies only what is meaningful for the situation. Values are intended to be
 * non-sensitive identifiers — never tokens, secrets, cookies, or form values.
 */
interface DiagnosticContext {
    /** The package that produced the diagnostic, e.g. `streetui`. */
    readonly package?: string;
    /** The operation underway, e.g. `hydrate`, `compile`, `navigate`. */
    readonly operation?: string;
    /** The graph node id involved, when applicable. */
    readonly nodeId?: string;
    /** The route path involved, when applicable. */
    readonly route?: string;
    /** A resource identifier involved, when applicable. */
    readonly resource?: string;
    /**
     * The component name involved (from a `component()` definition's `name`), when
     * the diagnostic arises inside a component. A stable identifier, never a value.
     */
    readonly component?: string;
    /**
     * A signal identifier involved (e.g. a named/derived signal's debug name),
     * when applicable. This is the signal's *identity*, never its current value —
     * signal contents may be user data and are never placed in a diagnostic.
     */
    readonly signal?: string;
    /**
     * Where in a node's lifecycle the diagnostic arose: `render` (building the
     * subtree), `effect` (a reactive effect), `setup` (a component's setup),
     * `loader` (a resource loader), `event` (a DOM handler), or `hydrate`.
     */
    readonly phase?: 'render' | 'effect' | 'setup' | 'loader' | 'event' | 'hydrate';
    /**
     * A non-sensitive DOM association for where the error surfaced, e.g.
     * `div#app` or `button.primary`. Callers must pass only structural
     * identifiers (tag / id / class) — never `textContent`, attribute *values*,
     * or anything that could carry user data.
     */
    readonly element?: string;
}
/**
 * The application-provided logging seam. Every method is optional; the
 * framework calls only the ones present. Implementations must not throw.
 */
interface DiagnosticSink {
    debug?(message: string, context?: DiagnosticContext): void;
    info?(message: string, context?: DiagnosticContext): void;
    warn?(message: string, context?: DiagnosticContext): void;
    error?(message: string, context?: DiagnosticContext): void;
}
/** Format a context object as a compact ` [k=v, …]` suffix (empty when bare). */
declare function formatDiagnosticContext(context?: DiagnosticContext): string;
/**
 * A framework error whose message carries structured, non-sensitive context so
 * a developer immediately sees which package/operation/node was involved. The
 * message never embeds a stack or environment values; production stack
 * disclosure decisions stay with the server layer.
 */
declare class StreetFrameworkError extends Error {
    readonly context: DiagnosticContext | undefined;
    constructor(message: string, context?: DiagnosticContext);
}
/** Build a `StreetFrameworkError` with the given context. */
declare function frameworkError(message: string, context?: DiagnosticContext): StreetFrameworkError;
/**
 * Route a diagnostic to a sink if it implements the matching level. Safe to
 * call with `undefined` — it simply does nothing, which is the default (no
 * logging) posture. Never throws even if the sink method does.
 */
declare function reportDiagnostic(sink: DiagnosticSink | undefined, level: 'debug' | 'info' | 'warn' | 'error', message: string, context?: DiagnosticContext): void;
/** A sink that forwards to a `console`-like object, one call per level. */
declare function consoleDiagnosticSink(logger?: Partial<Record<'debug' | 'info' | 'warn' | 'error', (msg: string) => void>>): DiagnosticSink;
/**
 * Options controlling how much of an error is disclosed in a report.
 *
 * Everything defaults to the SAFE (production) posture: no stack, no cause
 * chain. A stack trace can embed absolute file paths and, in some runtimes,
 * source fragments, so it is opt-in and belongs to development / trusted server
 * logging — never to a report that might reach a browser or a third party.
 */
interface ErrorReportOptions {
    /** Include `error.stack` in the report. Default `false` (production-safe). */
    readonly includeStack?: boolean;
    /**
     * Follow and describe `error.cause` (recursively, up to a small depth) when
     * present. Default `false`. The cause is described with the SAME redaction
     * rules — only its name/message/(optional)stack, never arbitrary properties.
     */
    readonly includeCause?: boolean;
}
/**
 * A production-safe, serializable description of an error plus the framework
 * context in which it surfaced. This is what §7 asks a diagnostics sink to
 * receive: enough to locate the failure (component / route / resource / signal /
 * phase / DOM association via {@link DiagnosticContext}) WITHOUT any sensitive
 * data. It deliberately carries ONLY the error's class name and message (both
 * author-controlled), never enumerated own-properties (which frequently hold
 * request bodies, tokens, or user records), and the stack only when explicitly
 * opted in.
 */
interface ErrorReport {
    /** The error's constructor name, e.g. `TypeError` (`Error` when unknown). */
    readonly name: string;
    /** The error's message. For a non-Error throw, its `String(...)` form. */
    readonly message: string;
    /** Whether the thrown value was a real `Error` instance. */
    readonly isError: boolean;
    /** The framework context, when supplied. */
    readonly context?: DiagnosticContext;
    /** The stack, only when `includeStack` was set and one exists. */
    readonly stack?: string;
    /** The described cause, only when `includeCause` was set and one exists. */
    readonly cause?: ErrorReport;
}
/**
 * Build a {@link ErrorReport} from any thrown value and (optionally) the
 * framework {@link DiagnosticContext} it surfaced in. Production-safe by
 * default: no stack, no cause, no enumerated properties. This is a pure
 * function — it performs no logging and has no side effects, so it is safe to
 * call from any layer (an `errorBoundary` `onError`, an `asyncBoundary` error
 * branch, a resource loader `catch`).
 */
declare function describeError(error: unknown, context?: DiagnosticContext, options?: ErrorReportOptions): ErrorReport;
/**
 * Convenience bridge: build a production-safe {@link ErrorReport} and route it
 * to a {@link DiagnosticSink} at the `error` level. The sink receives the
 * report's message and the structured {@link DiagnosticContext}; the full
 * report is returned to the caller for forwarding elsewhere (e.g. an app's own
 * crash reporter). Safe with `undefined` sink (no-op) and never throws.
 */
declare function reportError(sink: DiagnosticSink | undefined, error: unknown, context?: DiagnosticContext, options?: ErrorReportOptions): ErrorReport;

/**
 * StreetUI styling — canonical style model + stable identity.
 *
 * A *style* is pure, serializable data describing appearance (§1 Q1). This module
 * defines the authoring type model and the compile-time canonicalization that
 * turns any `StyleDef` into (a) a deterministic, order-independent canonical form
 * and (b) a stable class identity `s-<hash>`. Identical styles → identical
 * canonical form → identical identity → one shared CSS rule (§18 dedup).
 *
 * This file is pure and DOM-free: it never touches the graph, a signal, or the
 * renderer. It is the foundation the registry (`registry.ts`), CSS generator
 * (`css.ts`) and authoring API (`style.ts`) build on.
 */
/** A raw CSS value: a string (`'1px solid'`) or a number (lengths → px). */
type CSSValue = string | number;
/** The responsive breakpoint keys, smallest → largest. `base` is unconditional. */
type Breakpoint = 'base' | 'sm' | 'md' | 'lg' | 'xl';
/** A value that may vary by breakpoint. A bare value means "all breakpoints". */
type ResponsiveValue<T> = T | Partial<Record<Breakpoint, T>>;
/** Native CSS pseudo-states the browser owns (styled via CSS, never JS). */
type PseudoState = 'hover' | 'focus' | 'focusVisible' | 'focusWithin' | 'active' | 'disabled' | 'checked' | 'firstChild' | 'lastChild';
/** Reactive component/application states (distinct from native pseudo states). */
type ComponentState = 'open' | 'closed' | 'active' | 'selected' | 'expanded' | 'collapsed' | 'loading' | 'error' | 'disabled' | 'invalid' | 'busy' | 'current';
/**
 * A set of CSS declarations. Keys are camelCase CSS property names; values may be
 * responsive. The curated property surface gives autocomplete and rejects unknown
 * keys under strict object-literal checking (§23) without pulling an external
 * `csstype` dependency. Unlisted-but-valid CSS can still be set via the inline
 * `style` prop escape hatch on an element (precedence §5).
 */
interface StyleProperties {
    readonly display?: ResponsiveValue<CSSValue>;
    readonly position?: ResponsiveValue<CSSValue>;
    readonly inset?: ResponsiveValue<CSSValue>;
    readonly top?: ResponsiveValue<CSSValue>;
    readonly right?: ResponsiveValue<CSSValue>;
    readonly bottom?: ResponsiveValue<CSSValue>;
    readonly left?: ResponsiveValue<CSSValue>;
    readonly zIndex?: ResponsiveValue<CSSValue>;
    readonly width?: ResponsiveValue<CSSValue>;
    readonly minWidth?: ResponsiveValue<CSSValue>;
    readonly maxWidth?: ResponsiveValue<CSSValue>;
    readonly height?: ResponsiveValue<CSSValue>;
    readonly minHeight?: ResponsiveValue<CSSValue>;
    readonly maxHeight?: ResponsiveValue<CSSValue>;
    readonly margin?: ResponsiveValue<CSSValue>;
    readonly marginTop?: ResponsiveValue<CSSValue>;
    readonly marginRight?: ResponsiveValue<CSSValue>;
    readonly marginBottom?: ResponsiveValue<CSSValue>;
    readonly marginLeft?: ResponsiveValue<CSSValue>;
    readonly padding?: ResponsiveValue<CSSValue>;
    readonly paddingTop?: ResponsiveValue<CSSValue>;
    readonly paddingRight?: ResponsiveValue<CSSValue>;
    readonly paddingBottom?: ResponsiveValue<CSSValue>;
    readonly paddingLeft?: ResponsiveValue<CSSValue>;
    readonly gap?: ResponsiveValue<CSSValue>;
    readonly rowGap?: ResponsiveValue<CSSValue>;
    readonly columnGap?: ResponsiveValue<CSSValue>;
    readonly flex?: ResponsiveValue<CSSValue>;
    readonly flexDirection?: ResponsiveValue<CSSValue>;
    readonly flexWrap?: ResponsiveValue<CSSValue>;
    readonly flexGrow?: ResponsiveValue<CSSValue>;
    readonly flexShrink?: ResponsiveValue<CSSValue>;
    readonly flexBasis?: ResponsiveValue<CSSValue>;
    readonly alignItems?: ResponsiveValue<CSSValue>;
    readonly alignSelf?: ResponsiveValue<CSSValue>;
    readonly justifyContent?: ResponsiveValue<CSSValue>;
    readonly justifySelf?: ResponsiveValue<CSSValue>;
    readonly gridTemplateColumns?: ResponsiveValue<CSSValue>;
    readonly gridTemplateRows?: ResponsiveValue<CSSValue>;
    readonly gridColumn?: ResponsiveValue<CSSValue>;
    readonly gridRow?: ResponsiveValue<CSSValue>;
    readonly placeItems?: ResponsiveValue<CSSValue>;
    readonly color?: ResponsiveValue<CSSValue>;
    readonly background?: ResponsiveValue<CSSValue>;
    readonly backgroundColor?: ResponsiveValue<CSSValue>;
    readonly borderColor?: ResponsiveValue<CSSValue>;
    readonly border?: ResponsiveValue<CSSValue>;
    readonly borderWidth?: ResponsiveValue<CSSValue>;
    readonly borderStyle?: ResponsiveValue<CSSValue>;
    readonly borderRadius?: ResponsiveValue<CSSValue>;
    readonly boxShadow?: ResponsiveValue<CSSValue>;
    readonly outline?: ResponsiveValue<CSSValue>;
    readonly outlineOffset?: ResponsiveValue<CSSValue>;
    readonly opacity?: ResponsiveValue<CSSValue>;
    readonly fontFamily?: ResponsiveValue<CSSValue>;
    readonly fontSize?: ResponsiveValue<CSSValue>;
    readonly fontWeight?: ResponsiveValue<CSSValue>;
    readonly lineHeight?: ResponsiveValue<CSSValue>;
    readonly letterSpacing?: ResponsiveValue<CSSValue>;
    readonly textAlign?: ResponsiveValue<CSSValue>;
    readonly textDecoration?: ResponsiveValue<CSSValue>;
    readonly textTransform?: ResponsiveValue<CSSValue>;
    readonly whiteSpace?: ResponsiveValue<CSSValue>;
    readonly overflow?: ResponsiveValue<CSSValue>;
    readonly overflowX?: ResponsiveValue<CSSValue>;
    readonly overflowY?: ResponsiveValue<CSSValue>;
    readonly clipPath?: ResponsiveValue<CSSValue>;
    readonly cursor?: ResponsiveValue<CSSValue>;
    readonly transition?: ResponsiveValue<CSSValue>;
    readonly transform?: ResponsiveValue<CSSValue>;
    readonly transformOrigin?: ResponsiveValue<CSSValue>;
    readonly animation?: ResponsiveValue<CSSValue>;
    readonly animationName?: ResponsiveValue<CSSValue>;
    readonly animationDuration?: ResponsiveValue<CSSValue>;
    readonly animationTimingFunction?: ResponsiveValue<CSSValue>;
    readonly animationDelay?: ResponsiveValue<CSSValue>;
    readonly animationIterationCount?: ResponsiveValue<CSSValue>;
    readonly animationDirection?: ResponsiveValue<CSSValue>;
    readonly animationFillMode?: ResponsiveValue<CSSValue>;
    readonly animationPlayState?: ResponsiveValue<CSSValue>;
    readonly willChange?: ResponsiveValue<CSSValue>;
    readonly appearance?: ResponsiveValue<CSSValue>;
    readonly userSelect?: ResponsiveValue<CSSValue>;
    readonly pointerEvents?: ResponsiveValue<CSSValue>;
    /** Reactive CSS custom properties (`--name`) — the signal-driven channel (§6). */
    readonly vars?: Readonly<Record<`--${string}`, CSSValue>>;
}
/**
 * A full style definition: base declarations plus optional pseudo-state,
 * component-state and a11y-state overrides. Each override block is itself a set
 * of (non-responsive) declarations.
 */
interface StyleDef extends StyleProperties {
    /** Native pseudo-state overrides (`:hover`, `:focus-visible`, …) — §9. */
    readonly on?: Partial<Record<PseudoState, StyleProperties>>;
    /** Component-state overrides → `[data-<state>]` selectors — §10. */
    readonly when?: Partial<Record<ComponentState, StyleProperties>>;
}
/** A canonical, order-independent, JSON-serializable form of a `StyleDef`. */
type CanonicalStyle = string;
/** camelCase → kebab-case CSS property name (`backgroundColor` → `background-color`). */
declare function cssPropName(camel: string): string;
/** Format a CSS value: unitless numbers on length props get `px`; others pass through. */
declare function cssValue(prop: string, value: CSSValue): string;
/** Produce the canonical form of a style definition (stable across key order). */
declare function canonicalize(def: StyleDef): CanonicalStyle;
/**
 * FNV-1a (two seeds) → a stable, dependency-free class identity. Two 32-bit
 * passes are concatenated in base36 to make collisions between distinct styles
 * astronomically unlikely for realistic app style counts. Deterministic: the
 * same canonical form always yields the same id on server and client (§11/§12).
 */
declare function hashIdentity(canonical: CanonicalStyle): string;
/** Convenience: canonical form + identity in one call. */
declare function identityOf(def: StyleDef): {
    canonical: CanonicalStyle;
    id: string;
};

/**
 * StreetUI styling — the deduplicated CSS rule registry (§15/§18).
 *
 * A single module-level registry maps a *style identity* (`s-<hash>`) to the CSS
 * rule text for that style. Registration is idempotent: registering the same
 * identity twice with identical content is a no-op, so 10,000 elements that share
 * a style produce exactly one rule (§18). The registry is keyed by identity —
 * **never** by node or element — so it holds only bounded rule strings and
 * unmounting nodes never strands state in it (§17 memory-leak avoidance).
 *
 * Ordering is deterministic (insertion order within fixed category bands), so
 * serialization is byte-stable across runs (§11/§16). An empty registry
 * serializes to the empty string, mirroring `renderHead` — so a route that
 * declares no styles emits no `<style>` block and stays byte-identical.
 */
/** Category bands fix the serialization order regardless of registration order. */
type StyleBand = 'tokens' | 'base' | 'responsive' | 'state' | 'variant';
declare class StyleRegistry {
    private readonly _entries;
    private _seq;
    /** True once the registry has adopted a server-emitted stylesheet (§12). */
    private _adopted;
    /**
     * Register (idempotently) the CSS for a style identity. Returns the identity so
     * callers can chain. Re-registering an existing id with the same css is a no-op;
     * with different css it keeps the first registration (identity is content-derived,
     * so this cannot happen for honest input and signals a hash collision if it does).
     */
    register(id: string, band: StyleBand, css: string): string;
    /** Whether an identity is already present (server-adopted or locally registered). */
    has(id: string): boolean;
    /** Number of distinct rules held (bounded by source diversity, not instances). */
    get size(): number;
    /**
     * Seed the registry from identities a server stylesheet already shipped (§12).
     * We only need the *keys* to avoid re-emitting duplicates; the rule text is
     * already in the adopted `<style>` element, so a placeholder css is stored.
     */
    adoptServerIdentities(ids: Iterable<string>): void;
    get adopted(): boolean;
    /** Serialize all rules to a single CSS string in deterministic band order. */
    serializeCSS(): string;
    /** The ordered list of identities present (for the `data-streetui-css-keys` attr). */
    identities(): string[];
    /** Clear everything — test isolation and per-process reset only. */
    reset(): void;
}
/**
 * The process-wide registry instance. Because consuming packages (`dsl` authoring
 * and `renderer` SSR) both resolve `streetui` to the *same* module, they
 * share this one instance — the authoring side registers rules and the SSR side
 * serializes them, with no cross-package plumbing.
 */
declare const styleRegistry: StyleRegistry;

/**
 * StreetUI styling — compile-time CSS generation (§7-§10, §15).
 *
 * Turns a `StyleDef` + its stable identity into CSS rule text. All generation is
 * pure and happens at author/compile time; nothing here runs per render. Output
 * is deterministic (properties sorted, fixed media order) so identities and bytes
 * are stable across server and client (§11/§16).
 *
 * Property values that are objects of the shape `{ base, sm, md, lg, xl }` expand
 * to a base declaration plus `@media (min-width: …)` blocks (§7). Pseudo states
 * (`on`) become `.id:hover` etc. (§9). Component states (`when`) become
 * `.id[data-<state>]` selectors driven reactively by a data attribute (§10).
 */

/** Default breakpoint minimum widths (px). Mirrors the default token breakpoints. */
declare const BREAKPOINTS: Readonly<Record<Exclude<Breakpoint, 'base'>, number>>;
/** `data-<state>` attribute name a component state maps to (§10). */
declare function stateAttr(state: ComponentState): string;
interface GeneratedCSS {
    /** Base rule + any responsive `@media` blocks. */
    readonly base: string;
    /** Pseudo-state and component-state rules (empty string when none). */
    readonly state: string;
    /** Whether the style declares any responsive values (for registry banding). */
    readonly hasResponsive: boolean;
}
/**
 * Generate the CSS for a style identity. The caller registers `base` under the
 * `base`/`responsive` band and `state` under the `state` band.
 */
declare function generateCSS(id: string, def: StyleDef): GeneratedCSS;

/**
 * StreetUI styling — first-class design tokens + theming (§6/§7/§16).
 *
 * Tokens are declared as a nested tree of named values and compiled to CSS custom
 * properties emitted once under `:root`, with dark-mode values emitted under
 * `[data-theme="dark"]`. A token *reference* is the string `var(--name)`, usable
 * anywhere a CSS value is expected inside a `StyleDef`. Dark mode therefore never
 * duplicates a style definition — it only re-points the variables (§7/§16).
 *
 * SSR/hydration safety: the token CSS is registered in the shared style registry
 * (tokens band) and serialized into the single `<style data-streetui-css>` block
 * like any other rule, so the server ships the variables and the client adopts
 * them. Switching theme is a single `data-theme` attribute flip on the root
 * element — no restyle work, no re-render (§16).
 */
type TokenLeaf = string | number;
interface TokenTree {
    readonly [key: string]: TokenLeaf | TokenTree;
}
/** The ref tree mirrors the input shape; every leaf becomes a `var(--…)` string. */
type TokenRefs<T> = {
    readonly [K in keyof T]: T[K] extends TokenLeaf ? string : T[K] extends TokenTree ? TokenRefs<T[K]> : never;
};
interface ThemeTokenDef<L extends TokenTree> {
    /** Base (light) token values — required; defines the full token surface. */
    readonly light: L;
    /** Dark overrides — a partial subset; unlisted tokens inherit the light value. */
    readonly dark?: DeepPartial<L>;
}
type DeepPartial<T> = {
    [K in keyof T]?: T[K] extends TokenLeaf ? TokenLeaf : T[K] extends TokenTree ? DeepPartial<T[K]> : never;
};
interface ThemeTokens<L extends TokenTree> {
    /** Token references (`var(--…)`) mirroring the declared tree. */
    readonly ref: TokenRefs<L>;
    /** The generated CSS for `:root` and `[data-theme="dark"]`. */
    readonly css: string;
    /** The stable identity under which this token block is registered. */
    readonly id: string;
}
/**
 * Declare a set of design tokens. Returns typed references and registers the
 * generated `:root` / `[data-theme="dark"]` CSS in the shared registry (idempotent).
 */
declare function createThemeTokens<L extends TokenTree>(def: ThemeTokenDef<L>): ThemeTokens<L>;
/**
 * The default StreetUI semantic token set (§6/§7). Covers color surfaces, content,
 * borders, accent, focus and danger semantics, plus spacing, radii, typography,
 * shadows, z-index, durations, easings and breakpoints. Dark mode re-points only
 * the color semantics; structural tokens (spacing, radii, …) are theme-invariant.
 */
declare const DEFAULT_TOKENS: {
    readonly surface: {
        readonly background: "#ffffff";
        readonly raised: "#f7f7f8";
        readonly sunken: "#eeeef1";
        readonly overlay: "rgba(17,17,20,0.55)";
    };
    readonly content: {
        readonly primary: "#17171a";
        readonly secondary: "#55555f";
        readonly muted: "#8a8a95";
        readonly inverse: "#ffffff";
    };
    readonly border: {
        readonly default: "#e3e3e8";
        readonly strong: "#c9c9d1";
        readonly subtle: "#f0f0f3";
    };
    readonly accent: {
        readonly primary: "#4f46e5";
        readonly hover: "#4338ca";
        readonly contrast: "#ffffff";
    };
    readonly focus: {
        readonly ring: "#6366f1";
    };
    readonly danger: {
        readonly surface: "#fef2f2";
        readonly border: "#fecaca";
        readonly content: "#b91c1c";
        readonly solid: "#dc2626";
    };
    readonly success: {
        readonly content: "#15803d";
        readonly solid: "#16a34a";
    };
    readonly space: {
        readonly '0': "0";
        readonly '1': "4px";
        readonly '2': "8px";
        readonly '3': "12px";
        readonly '4': "16px";
        readonly '5': "24px";
        readonly '6': "32px";
        readonly '8': "48px";
        readonly '10': "64px";
    };
    readonly radius: {
        readonly sm: "4px";
        readonly md: "8px";
        readonly lg: "12px";
        readonly xl: "16px";
        readonly full: "9999px";
    };
    readonly font: {
        readonly sans: "ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif";
        readonly mono: "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";
    };
    readonly size: {
        readonly xs: "12px";
        readonly sm: "14px";
        readonly md: "16px";
        readonly lg: "18px";
        readonly xl: "24px";
        readonly '2xl': "32px";
        readonly '3xl': "44px";
    };
    readonly weight: {
        readonly normal: "400";
        readonly medium: "500";
        readonly semibold: "600";
        readonly bold: "700";
    };
    readonly leading: {
        readonly tight: "1.2";
        readonly normal: "1.5";
        readonly relaxed: "1.7";
    };
    readonly shadow: {
        readonly sm: "0 1px 2px rgba(17,17,20,0.08)";
        readonly md: "0 4px 12px rgba(17,17,20,0.1)";
        readonly lg: "0 12px 32px rgba(17,17,20,0.16)";
    };
    readonly z: {
        readonly base: "0";
        readonly dropdown: "1000";
        readonly overlay: "1100";
        readonly toast: "1200";
    };
    readonly duration: {
        readonly fast: "120ms";
        readonly base: "200ms";
        readonly slow: "320ms";
    };
    readonly easing: {
        readonly standard: "cubic-bezier(0.2,0,0,1)";
        readonly emphasized: "cubic-bezier(0.3,0,0,1)";
    };
};
/** The ready-to-use default theme tokens, registered on import. */
declare const tokens: ThemeTokens<{
    readonly surface: {
        readonly background: "#ffffff";
        readonly raised: "#f7f7f8";
        readonly sunken: "#eeeef1";
        readonly overlay: "rgba(17,17,20,0.55)";
    };
    readonly content: {
        readonly primary: "#17171a";
        readonly secondary: "#55555f";
        readonly muted: "#8a8a95";
        readonly inverse: "#ffffff";
    };
    readonly border: {
        readonly default: "#e3e3e8";
        readonly strong: "#c9c9d1";
        readonly subtle: "#f0f0f3";
    };
    readonly accent: {
        readonly primary: "#4f46e5";
        readonly hover: "#4338ca";
        readonly contrast: "#ffffff";
    };
    readonly focus: {
        readonly ring: "#6366f1";
    };
    readonly danger: {
        readonly surface: "#fef2f2";
        readonly border: "#fecaca";
        readonly content: "#b91c1c";
        readonly solid: "#dc2626";
    };
    readonly success: {
        readonly content: "#15803d";
        readonly solid: "#16a34a";
    };
    readonly space: {
        readonly '0': "0";
        readonly '1': "4px";
        readonly '2': "8px";
        readonly '3': "12px";
        readonly '4': "16px";
        readonly '5': "24px";
        readonly '6': "32px";
        readonly '8': "48px";
        readonly '10': "64px";
    };
    readonly radius: {
        readonly sm: "4px";
        readonly md: "8px";
        readonly lg: "12px";
        readonly xl: "16px";
        readonly full: "9999px";
    };
    readonly font: {
        readonly sans: "ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif";
        readonly mono: "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";
    };
    readonly size: {
        readonly xs: "12px";
        readonly sm: "14px";
        readonly md: "16px";
        readonly lg: "18px";
        readonly xl: "24px";
        readonly '2xl': "32px";
        readonly '3xl': "44px";
    };
    readonly weight: {
        readonly normal: "400";
        readonly medium: "500";
        readonly semibold: "600";
        readonly bold: "700";
    };
    readonly leading: {
        readonly tight: "1.2";
        readonly normal: "1.5";
        readonly relaxed: "1.7";
    };
    readonly shadow: {
        readonly sm: "0 1px 2px rgba(17,17,20,0.08)";
        readonly md: "0 4px 12px rgba(17,17,20,0.1)";
        readonly lg: "0 12px 32px rgba(17,17,20,0.16)";
    };
    readonly z: {
        readonly base: "0";
        readonly dropdown: "1000";
        readonly overlay: "1100";
        readonly toast: "1200";
    };
    readonly duration: {
        readonly fast: "120ms";
        readonly base: "200ms";
        readonly slow: "320ms";
    };
    readonly easing: {
        readonly standard: "cubic-bezier(0.2,0,0,1)";
        readonly emphasized: "cubic-bezier(0.3,0,0,1)";
    };
}>;

/**
 * StreetUI styling — the public authoring API: `style()` and `styleVariants()`.
 *
 * `style(def)` canonicalizes a definition, registers its deduplicated CSS once,
 * and returns the stable class token (a plain string) to spread onto an element's
 * `class` (§2/§5/§18). Being a plain string makes it trivially composable and
 * tree-shakeable with no runtime dependency. A *static* `style()` call opens no
 * signal, no subscription and no effect (§3) — it is pure compile-time data.
 *
 * `styleVariants(cfg)` builds a type-safe family of styles. Variant group keys and
 * values are mapped types, so selecting an unknown group or value is a TypeScript
 * error (§11/§23) — no stringly-typed variant names. The returned function yields
 * the merged, deduped class list for a selection.
 */

/**
 * Register a style definition and return its class token. Idempotent: the same
 * definition always maps to the same token and a single shared CSS rule.
 */
declare function style(def: StyleDef): string;
/** Join class tokens/strings, dropping falsy entries. `cx('a', cond && 'b')`. */
declare function cx(...parts: Array<string | false | null | undefined>): string;
type VariantGroups = Record<string, Record<string, StyleDef>>;
interface VariantConfig<V extends VariantGroups> {
    /** Shared declarations applied to every variant combination. */
    readonly base?: StyleDef;
    /** Named variant groups; each maps a value name to its own `StyleDef`. */
    readonly variants: V;
    /** Default selection used when a group is omitted at call time. */
    readonly defaultVariants?: {
        readonly [K in keyof V]?: keyof V[K];
    };
}
/** A selection object: for each group, an optional value from that group. */
type VariantSelection<V extends VariantGroups> = {
    readonly [K in keyof V]?: keyof V[K];
};
/** The callable produced by `styleVariants` — `button({ intent:'danger' })`. */
type VariantFn<V extends VariantGroups> = (selection?: VariantSelection<V>) => string;
/**
 * Build a type-safe variant family. All base and variant-value styles are
 * registered up front (each as its own deduped identity), so calling the returned
 * function only *selects* among precompiled classes — no runtime style work (§11).
 */
declare function styleVariants<V extends VariantGroups>(cfg: VariantConfig<V>): VariantFn<V>;

/**
 * StreetUI styling — reactive scalar styles (§4).
 *
 * A reactive scalar style value (a signal) must update **one** property on **one**
 * element with no class churn and no DOM reconstruction. The mechanism rides the
 * existing reactive seam exactly: the appearance is a *static*, deduped rule that
 * reads a **CSS custom property**, and the signal drives only that custom
 * property via the renderer's existing `style.<prop>` binding path
 * (`applyProp` → `el.style.setProperty`). One signal → one `setProperty`.
 *
 * `styleWithVars(staticDef, reactiveProps)` returns:
 *   • `class` — the static class token for a `StyleDef` whose reactive properties
 *     are rewritten to `var(--s-<prop>)` (so the rule itself never changes), and
 *   • `vars`  — the custom-property name per reactive prop (`width` → `--s-width`),
 *     and the `style.<custom-prop>` binding key to attach the signal to.
 *
 * This introduces no second reactive system and no runtime style framework: the
 * returned `class` is a plain string (deduped like any other `style()`), and the
 * reactive binding is a single `StateRef { propKey: 'style.--s-<prop>' }` wired by
 * the existing `wireSignalBindings`/`applyProp` pipeline. Core stays free of any
 * `streetui` dependency — the caller supplies the signal at the DSL layer.
 */

/** The reactive binding surface for one `styleWithVars` call. */
interface ReactiveStyle<K extends string> {
    /** Static, deduped class token; reactive props read `var(--s-<prop>)`. */
    readonly class: string;
    /** Per reactive prop: its CSS custom-property name, e.g. `width` → `--s-width`. */
    readonly vars: Readonly<Record<K, string>>;
    /** Per reactive prop: the renderer binding key, e.g. `width` → `style.--s-width`. */
    readonly bind: Readonly<Record<K, string>>;
}
/** The CSS custom-property name a reactive prop compiles to (`width` → `--s-width`). */
declare function reactiveVarName(prop: string): string;
/**
 * Compile a style whose listed properties are driven by signals at runtime. The
 * rule is static and deduped (reads `var(--s-<prop>)`); the caller binds each
 * `bind[prop]` key to a signal so one change is one `setProperty` (§4).
 */
declare function styleWithVars<K extends string>(staticDef: StyleDef, reactiveProps: readonly K[]): ReactiveStyle<K>;
/**
 * Format a reactive scalar for assignment to its custom property, applying the
 * same unit rule as static values (unitless numbers on length props get `px`).
 * Use this in the signal/derived that feeds a `styleWithVars` binding so that
 * `widthSignal.set(240)` yields `--s-width: 240px`.
 */
declare function reactiveVarValue(prop: string, value: CSSValue): string;

/**
 * StreetUI styling — layout primitives (§12).
 *
 * Thin, token-driven `style()` presets — **not** new graph nodes and **not** a
 * utility-class framework. Each primitive is a function that takes a small, typed
 * option bag and returns a single deduplicated class string, so composing a layout
 * is `container()`, `stack({ gap: 4 })`, etc. Because they compile through the same
 * `style()` registry, identical option bags share one CSS rule (§15/§18), and they
 * carry no runtime dependency — the return value is a plain class token.
 *
 * Spacing/gap options are **space-scale keys** (`'0'`…`'10'`) resolved to the
 * `--space-*` token variables, so layouts stay on the design system by default and
 * remain theme-consistent. Raw CSS escape values are still accepted where a bare
 * `CSSValue` is allowed.
 */

/** A spacing-scale key resolved against the `--space-*` tokens. */
type SpaceKey = keyof typeof tokens.ref.space;
interface ContainerStyleOptions {
    /** Max content width (default `1120px`). A number is treated as `px`. */
    readonly max?: CSSValue;
    /** Horizontal padding as a space-scale key (default `'4'`). */
    readonly padX?: SpaceKey;
    /** Center the container horizontally (default `true`). */
    readonly center?: boolean;
}
/** A width-capped, centered content column with symmetric horizontal padding. */
declare function container(opts?: ContainerStyleOptions): string;
interface StackOptions {
    /** Gap between children as a space-scale key (default `'4'`). */
    readonly gap?: SpaceKey;
    /** Cross-axis alignment (`align-items`). */
    readonly align?: 'start' | 'center' | 'end' | 'stretch';
    /** Main-axis distribution (`justify-content`). */
    readonly justify?: 'start' | 'center' | 'end' | 'between' | 'around';
}
/** A vertical flex column with a token-scaled gap. */
declare function stack(opts?: StackOptions): string;
interface RowOptions extends StackOptions {
    /** Allow children to wrap onto multiple lines (default `false`). */
    readonly wrap?: boolean;
}
/** A horizontal flex row with a token-scaled gap. */
declare function row(opts?: RowOptions): string;
interface GridOptions {
    /** Fixed column count, or `'auto'` for a responsive auto-fill track. */
    readonly columns?: number | 'auto';
    /** Minimum track width for the `'auto'` mode (default `220px`). */
    readonly min?: CSSValue;
    /** Gap between cells as a space-scale key (default `'4'`). */
    readonly gap?: SpaceKey;
}
/** A CSS grid with either a fixed column count or an auto-fill responsive track. */
declare function grid(opts?: GridOptions): string;
interface CenterOptions {
    /** Use inline-flex instead of block flex (default `false`). */
    readonly inline?: boolean;
    /** Minimum height of the centering box (e.g. `'100vh'`). */
    readonly minHeight?: CSSValue;
}
/** Center a single child on both axes. */
declare function center(opts?: CenterOptions): string;
interface SpacerOptions {
    /** Fixed size (both dimensions). When omitted the spacer flexes to fill. */
    readonly size?: CSSValue;
}
/** A flexible gap: fills available space, or a fixed box when `size` is given. */
declare function spacer(opts?: SpacerOptions): string;
/** The layout primitive family (§12), exported as one namespace object. */
declare const layout: {
    readonly container: typeof container;
    readonly stack: typeof stack;
    readonly row: typeof row;
    readonly grid: typeof grid;
    readonly center: typeof center;
    readonly spacer: typeof spacer;
};

/**
 * StreetUI styling — semantic typography + code/pre primitives (§13/§14).
 *
 * Token-driven `style()` presets for text roles. Each returns a deduplicated class
 * string and reads the `--font-*`, `--size-*`, `--weight-*`, `--leading-*` and
 * `--content-*` tokens, so typography stays on the design system and re-themes with
 * no duplicated definitions. `code` and `blockquote` cover the §14 code/pre case:
 * monospace, token surface, and sensible wrapping without an external prose sheet.
 */
type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;
interface HeadingStyleOptions {
    /** Semantic heading level 1–6 (drives size + weight). Default `2`. */
    readonly level?: HeadingLevel;
}
/** A display heading sized from the type scale by level. */
declare function heading(opts?: HeadingStyleOptions): string;
interface BodyOptions {
    /** Secondary (muted) body colour instead of primary. Default `false`. */
    readonly muted?: boolean;
    /** Line length cap for comfortable reading (e.g. `'65ch'`). */
    readonly measure?: string;
}
/** Default running-text body copy. */
declare function body(opts?: BodyOptions): string;
/** A small, medium-weight form/field label. */
declare function label(): string;
/** The smallest supporting text (captions, help, metadata). */
declare function caption(): string;
/** An inline text link with a token accent colour and accessible focus/hover. */
declare function link(): string;
/** Inline monospace code (§14). */
declare function code(): string;
/** A fenced code block / `<pre>` surface: monospace, scrollable, token surface (§14). */
declare function pre(): string;
/** A left-ruled quotation block. */
declare function blockquote(): string;
/** A vertically-spaced list body. */
declare function list(): string;
/** The semantic typography family (§13/§14), exported as one namespace object. */
declare const text: {
    readonly heading: typeof heading;
    readonly body: typeof body;
    readonly label: typeof label;
    readonly caption: typeof caption;
    readonly link: typeof link;
    readonly code: typeof code;
    readonly pre: typeof pre;
    readonly blockquote: typeof blockquote;
    readonly list: typeof list;
};

/**
 * StreetUI styling — accessibility styling helpers (§19).
 *
 * These presets make the *default* accessible: a strong, token-driven focus ring
 * that is visible against any surface, and a correct visually-hidden pattern that
 * still exposes content to assistive technology. They introduce **no** parallel
 * a11y-state system — focus styling rides the browser's native `:focus-visible`,
 * and component a11y states remain the ARIA attributes the renderer already sets,
 * read from CSS via the `when`/attribute selectors (§10/§15).
 */
interface FocusRingOptions {
    /** Ring colour (default `--focus-ring` token). */
    readonly color?: string;
    /** Ring thickness in px (default `2`). */
    readonly width?: number;
    /** Gap between the element and the ring in px (default `2`). */
    readonly offset?: number;
}
/**
 * A strong keyboard focus indicator applied via native `:focus-visible` only, so
 * pointer focus stays quiet while keyboard focus is always clearly visible (§19).
 * Compose onto any interactive element's class list.
 */
declare function focusRing(opts?: FocusRingOptions): string;
/**
 * Visually-hidden content that remains available to screen readers (the correct
 * `sr-only` pattern — not `display:none`, which also hides from AT).
 */
declare function visuallyHidden(): string;
/**
 * A skip-link style: visually hidden until focused, then revealed as a prominent
 * on-surface control. Pairs with `visuallyHidden` semantics but becomes visible on
 * keyboard focus so "skip to content" links work.
 */
declare function skipLink(): string;
/** The accessibility styling family (§19). */
declare const a11y: {
    readonly focusRing: typeof focusRing;
    readonly visuallyHidden: typeof visuallyHidden;
    readonly skipLink: typeof skipLink;
};

/**
 * StreetUI styling — form control styling (§20).
 *
 * Token-driven presets for the common form surfaces. Validation styling is read
 * from the ARIA attribute the renderer already sets (`[aria-invalid="true"]`) via
 * the `when: { invalid }` → `[data-invalid]` channel *and* a native attribute
 * selector, so there is no parallel form-state system — the control's accessible
 * state drives its appearance (§10/§15/§19). Focus uses native `:focus-visible`
 * with the strong focus-ring token (§19).
 */
/** A single-line text input / select / textarea surface. */
declare function input(): string;
/** The vertical field wrapper: label, control and help/error stacked with gap. */
declare function field(): string;
/** A field label (medium weight, primary content colour). */
declare function fieldLabel(): string;
/** Supporting help text under a control. */
declare function fieldHelp(): string;
/** An inline validation error message, coloured with the danger token. */
declare function fieldError(): string;
/** A primary action button surface with hover/active/disabled and focus ring. */
declare function button(): string;
/** The form styling family (§20). */
declare const form: {
    readonly field: typeof field;
    readonly input: typeof input;
    readonly label: typeof fieldLabel;
    readonly help: typeof fieldHelp;
    readonly error: typeof fieldError;
    readonly button: typeof button;
};

/**
 * StreetUI styling — overlay surface styling (§21).
 *
 * Token-driven presets for the overlay surfaces produced by the overlay runtime
 * (dialog, popover, tooltip, dropdown, toast + backdrop). Styling here is **only**
 * appearance (surface colour, elevation, radius, z-index from the `--z-*` tokens);
 * positioning, focus trapping and open/close lifecycle remain owned by the overlay
 * runtime and the transition engine (§18/§21). Elevation and z-index come from
 * tokens so overlays stack predictably and re-theme with the rest of the system.
 */
/** The dimmed, full-viewport backdrop behind a modal surface. */
declare function backdrop(): string;
/** A centered modal dialog surface (elevation + radius from tokens). */
declare function dialog(): string;
/** A small anchored popover panel. */
declare function popover(): string;
/** A compact, high-contrast tooltip bubble. */
declare function tooltip(): string;
/** A dropdown menu surface. */
declare function dropdown(): string;
/** A single dropdown menu item (hover/selected via tokens + attribute state). */
declare function dropdownItem(): string;
/** A toast notification surface, elevated above overlays on the toast z-band. */
declare function toast(): string;
/** The overlay styling family (§21). */
declare const overlay: {
    readonly backdrop: typeof backdrop;
    readonly dialog: typeof dialog;
    readonly popover: typeof popover;
    readonly tooltip: typeof tooltip;
    readonly dropdown: typeof dropdown;
    readonly dropdownItem: typeof dropdownItem;
    readonly toast: typeof toast;
};

/**
 * StreetUI styling — animation tokens & declarative keyframes (§22).
 *
 * Animation is **pure CSS**: duration and easing come from the `--duration-*` /
 * `--easing-*` design tokens, and named `@keyframes` are registered once in the
 * shared registry (lazily, only when referenced, so unused animations add zero
 * bytes and unstyled routes stay byte-identical). There is **no animation
 * runtime** — StreetUI runs no timers, RAF loops, or JS tweening for these; the
 * browser owns playback. Enter/leave *lifecycle* animation remains the transition
 * engine's job (§18); these helpers supply the appearance it toggles.
 */

/** Duration token keys (`--duration-*`). */
type DurationKey = keyof typeof tokens.ref.duration;
/** Easing token keys (`--easing-*`). */
type EasingKey = keyof typeof tokens.ref.easing;
/** The built-in keyframe animations and their raw `@keyframes` bodies. */
declare const KEYFRAMES: Readonly<Record<string, string>>;
/** The animation names available to {@link animate}. */
type AnimationName = keyof typeof KEYFRAMES;
interface AnimateOptions {
    /** Duration token key (default `'base'`). */
    readonly duration?: DurationKey;
    /** Easing token key (default `'standard'`). */
    readonly easing?: EasingKey;
    /** Delay before the animation starts (e.g. `'100ms'`). */
    readonly delay?: CSSValue;
    /** Iteration count — a number or `'infinite'` (default `1`). */
    readonly iterations?: number | 'infinite';
    /** Fill mode (default `'both'` so the end state persists). */
    readonly fill?: 'none' | 'forwards' | 'backwards' | 'both';
}
/**
 * A class that plays a named keyframe animation using token duration/easing. The
 * keyframe rule is registered on first use. One class → one CSS `animation`; no JS
 * drives the frames.
 */
declare function animate(name: AnimationName, opts?: AnimateOptions): string;
interface TransitionOptions {
    /** Duration token key (default `'base'`). */
    readonly duration?: DurationKey;
    /** Easing token key (default `'standard'`). */
    readonly easing?: EasingKey;
    /** Delay before the transition starts (e.g. `'50ms'`). */
    readonly delay?: CSSValue;
}
/**
 * Build a CSS `transition` value for one or more properties using token
 * duration/easing — e.g. `transition(['opacity','transform'])`. Assign the result
 * to a `transition` style property; the browser performs the interpolation.
 */
declare function transition(properties: string | readonly string[], opts?: TransitionOptions): string;
/** The animation family (§22) — tokens + declarative keyframes, no runtime. */
declare const animation: {
    readonly animate: typeof animate;
    readonly transition: typeof transition;
    readonly keyframes: Readonly<Record<string, string>>;
};

/**
 * Compiler-phase validation of the ApplicationGraph.
 *
 * This runs after the DSL has built the graph but before the runtime
 * receives a CompiledApplication. More checks live here than in the
 * graph's own validate() because the compiler has broader context.
 */

declare function validateGraph(graph: ApplicationGraph): DiagnosticCollector;

/**
 * Graph transformation pass.
 *
 * After validation, the transformer prepares the graph for the runtime by:
 *  - Resolving implicit defaults (e.g. heading level defaults to 1)
 *  - Normalizing prop names
 *  - Assigning deterministic render keys where missing
 *  - Flattening / hoisting where beneficial
 */

declare function transformGraph(graph: ApplicationGraph): void;

/**
 * RuntimeNodeInstance — the runtime's live representation of a GraphNode.
 *
 * Each GraphNode in the compiled application gets a corresponding
 * RuntimeNodeInstance during mounting. The instance owns:
 *  - the DOM node(s) produced for this graph node
 *  - all signal subscriptions that drive updates
 *  - all DOM event listeners
 *  - child instances
 */

interface NodeInstanceOptions {
    readonly graphNode: GraphNode;
    readonly domNode: Node;
}
declare class RuntimeNodeInstance {
    readonly graphNode: GraphNode;
    domNode: Node;
    readonly children: RuntimeNodeInstance[];
    readonly cleanup: CleanupRegistry;
    private _mounted;
    constructor(options: NodeInstanceOptions);
    get isMounted(): boolean;
    mount(): void;
    unmount(): void;
    addChild(instance: RuntimeNodeInstance): void;
    /** Subscribe to a signal and register the unsubscribe for cleanup. */
    trackSignal<T>(signal: Signal<T> | ReadonlySignal<T>, handler: (value: T) => void): void;
    /** Register an arbitrary cleanup function (e.g. DOM event removal). */
    trackCleanup(fn: () => void): void;
}

/**
 * StreetUI update scheduler.
 *
 * Responsibilities:
 *  - Queue update callbacks
 *  - Batch synchronous enqueues into a single microtask flush
 *  - Guarantee ordering: higher priority jobs flush first
 *  - Prevent duplicate work for the same job key
 *  - Allow synchronous flush for tests
 */
type Priority = 'immediate' | 'normal' | 'idle';
interface Job {
    /** Unique key — if another job with the same key is already queued, it is replaced. */
    readonly key: string;
    readonly priority: Priority;
    readonly fn: () => void;
}
/**
 * Optional error-reporting hook (v0.9 §26/§27). Structurally compatible with
 * `streetui`'s `DiagnosticSink` (the `error` method) so an application can
 * route swallowed scheduler-job failures through its own logger instead of the
 * default `console.error`. Kept as a local structural type so the scheduler
 * stays dependency-free; no network, no telemetry. When unset, behaviour is
 * exactly as before.
 */
interface SchedulerDiagnostics {
    error?(message: string, context?: unknown): void;
}
declare class Scheduler {
    private readonly _queue;
    private _flushScheduled;
    private _flushing;
    private _diagnostics;
    /**
     * Install an optional diagnostic sink for swallowed job errors. Pass
     * `undefined` to restore the default `console.error` reporting. Additive and
     * opt-in — the scheduler never sends anything anywhere on its own.
     */
    setDiagnostics(sink: SchedulerDiagnostics | undefined): void;
    /** Total jobs currently queued. */
    get size(): number;
    /** True if a flush has been scheduled but not yet executed. */
    get isPending(): boolean;
    /**
     * Enqueue a job. If a job with the same key exists, the new one replaces it
     * (allowing callers to coalesce repeated updates for the same node).
     */
    schedule(job: Job): void;
    /** Schedule multiple jobs atomically. */
    scheduleAll(jobs: readonly Job[]): void;
    /**
     * Cancel a queued job by key. No-op if not queued.
     */
    cancel(key: string): void;
    /**
     * Synchronously flush all queued jobs (sorted by priority).
     * Useful in tests and for immediate rendering.
     */
    flush(): void;
    /** Clear all pending jobs without executing them. */
    clear(): void;
    private _scheduleMicrotask;
}
/** The shared global scheduler instance. */
declare const scheduler: Scheduler;
/** Convenience: schedule a normal-priority job. */
declare function scheduleUpdate(key: string, fn: () => void): void;
/** Convenience: schedule an immediate-priority job. */
declare function scheduleImmediate(key: string, fn: () => void): void;
/** Convenience: flush the global scheduler synchronously. */
declare function flushSync(): void;

/**
 * StreetUI Runtime.
 *
 * Owns:
 *  - Signal binding — wires signal subscriptions to renderer update calls
 *  - Event dispatch — calls registered handlers from graph events
 *  - Lifecycle — orchestrates mount, update cycles, unmount
 *
 * The runtime does NOT create DOM nodes. It calls into StreetRenderer
 * for all DOM operations.
 */

interface RuntimeOptions {
    readonly renderer: StreetRenderer;
    readonly scheduler?: Scheduler;
}
interface MountedApplication {
    readonly renderHandle: RenderHandle;
    readonly runtime: Runtime;
    unmount(): void;
    flush(): void;
}
declare class Runtime {
    private readonly _renderer;
    private readonly _scheduler;
    private readonly _cleanup;
    private _renderHandle;
    private _mounted;
    constructor(options: RuntimeOptions);
    get isMounted(): boolean;
    /**
     * Mount the compiled application into the given DOM container.
     */
    mount(compiled: CompiledApplication, container: Element): MountedApplication;
    unmount(): void;
    /**
     * Hydrate a container that already holds server-rendered HTML for this
     * application. Delegates to the renderer's `hydrate` (adopting the existing
     * DOM instead of recreating it) and falls back to `mount` for renderers that
     * cannot hydrate. Signal binding is identical to `mount`, so the live client
     * lifecycle is established the same way.
     */
    hydrate(compiled: CompiledApplication, container: Element): MountedApplication;
    /**
     * Walk the graph and subscribe to all signal-bound nodes.
     * When a signal changes, schedule a renderer update for that node.
     */
    private _bindSignals;
}
/**
 * Convenience factory — create a runtime, mount, and return the handle.
 */
declare function createRuntime(options: RuntimeOptions): Runtime;

/**
 * StreetUI event type catalogue.
 * Framework events are distinct from raw DOM events.
 */
type StreetEventType = 'click' | 'dblclick' | 'input' | 'change' | 'submit' | 'focus' | 'blur' | 'keydown' | 'keyup' | 'keypress' | 'mouseenter' | 'mouseleave' | 'mousemove' | 'mousedown' | 'mouseup' | 'pointerdown' | 'pointerup' | 'pointermove' | 'pointerenter' | 'pointerleave' | 'scroll' | 'resize' | 'mount' | 'unmount' | 'update';
interface StreetEvent<T = unknown> {
    readonly type: StreetEventType | string;
    readonly target: unknown;
    readonly data: T | undefined;
    readonly originalEvent: Event | undefined;
    readonly timestamp: number;
    defaultPrevented: boolean;
    stopPropagation(): void;
    preventDefault(): void;
}
declare function createStreetEvent<T = unknown>(type: StreetEventType | string, target: unknown, data?: T, originalEvent?: Event): StreetEvent<T>;
type EventHandler<T = unknown> = (event: StreetEvent<T>) => void;

/**
 * Framework-internal event bus.
 * Decouples emitters from handlers across subsystems.
 */

declare class EventBus {
    private readonly _handlers;
    on<T = unknown>(type: string, handler: EventHandler<T>): () => void;
    off<T = unknown>(type: string, handler: EventHandler<T>): void;
    once<T = unknown>(type: string, handler: EventHandler<T>): () => void;
    emit<T = unknown>(event: StreetEvent<T>): void;
    clear(type?: string): void;
    listenerCount(type: string): number;
}
declare const globalEventBus: EventBus;

/**
 * DOM ↔ StreetUI event bridge.
 *
 * Attaches native DOM event listeners and translates them into
 * StreetUI events dispatched to registered handlers.
 * The renderer uses this to wire events without coupling
 * DOM event mechanics into the render pipeline directly.
 */

interface DomBinding {
    remove(): void;
}
/**
 * Attach a DOM event listener that fires the given StreetUI handler.
 * Returns a binding whose `remove()` detaches the listener.
 */
declare function bindDomEvent<T extends Event = Event>(element: EventTarget, domEventType: StreetEventType | string, handler: EventHandler, options?: AddEventListenerOptions): DomBinding;
/**
 * A registry that tracks all DOM bindings for a single node,
 * making bulk teardown easy.
 */
declare class DomEventRegistry {
    private readonly _bindings;
    bind(element: EventTarget, type: StreetEventType | string, handler: EventHandler, options?: AddEventListenerOptions): void;
    removeAll(): void;
    get count(): number;
}

/**
 * Browser implementation of DOMAdapter — delegates directly to browser APIs.
 */

declare class BrowserDOMAdapter implements DOMAdapter {
    createElement(tag: string, ns?: string): Element;
    createTextNode(data: string): Text;
    createComment(data: string): Comment;
    createFragment(): DocumentFragment;
    appendChild(parent: Node, child: Node): void;
    insertBefore(parent: Node, child: Node, reference: Node | null): void;
    removeChild(parent: Node, child: Node): void;
    replaceChild(parent: Node, newChild: Node, oldChild: Node): void;
    setAttribute(element: Element, name: string, value: string): void;
    removeAttribute(element: Element, name: string): void;
    getAttribute(element: Element, name: string): string | null;
    setProperty(element: Element, name: string, value: unknown): void;
    setTextContent(node: Node, text: string): void;
    getTextContent(node: Node): string | null;
    addEventListener(target: EventTarget, type: string, handler: EventListener, options?: AddEventListenerOptions): void;
    removeEventListener(target: EventTarget, type: string, handler: EventListener, options?: EventListenerOptions): void;
    querySelector(root: Element | Document, selector: string): Element | null;
    querySelectorAll(root: Element | Document, selector: string): NodeListOf<Element>;
    getElementById(id: string): Element | null;
    focus(element: Element): void;
    body(): Element | null;
    head(): Element | null;
    activeElement(): Element | null;
    contains(ancestor: Element, node: Node): boolean;
    matches(element: Element, selector: string): boolean;
    isElement(node: Node): node is Element;
    isTextNode(node: Node): node is Text;
    tagName(element: Element): string;
    parentNode(node: Node): Node | null;
    nextSibling(node: Node): Node | null;
    firstChild(node: Node): Node | null;
    childNodes(node: Node): Node[];
}
declare const browserDOMAdapter: BrowserDOMAdapter;

/**
 * Server-side DOM node model.
 *
 * A tiny, dependency-free tree of plain objects that mirrors just enough of the
 * browser DOM for StreetUI's renderer to build a tree on the server and
 * serialize it to an HTML string. There is NO browser global here — these are
 * ordinary classes usable in any JavaScript environment (Node, workers, tests).
 *
 * The renderer never touches these types directly; it goes through the
 * `DOMAdapter` interface, and `ServerDOMAdapter` translates adapter calls into
 * operations on this model.
 */
type ServerNodeKind = 'element' | 'text' | 'comment' | 'fragment' | 'raw';
interface ServerNode {
    readonly kind: ServerNodeKind;
    parent: ServerParent | null;
}
type ServerParent = ServerElement | ServerFragment;
/** A minimal inline-style holder mirroring `element.style.setProperty`. */
declare class ServerStyle {
    readonly declarations: Map<string, string>;
    setProperty(name: string, value: string): void;
    get isEmpty(): boolean;
    toCss(): string;
}
declare class ServerText implements ServerNode {
    readonly kind: "text";
    parent: ServerParent | null;
    data: string;
    constructor(data: string);
}
declare class ServerComment implements ServerNode {
    readonly kind: "comment";
    parent: ServerParent | null;
    data: string;
    constructor(data: string);
}
declare class ServerFragment implements ServerNode {
    readonly kind: "fragment";
    parent: ServerParent | null;
    readonly children: ServerNode[];
}
/**
 * A pre-serialized, verbatim HTML fragment (v1.7 static SSR plan).
 *
 * Emitted for provably-static subtrees whose HTML the compiler-derived static
 * SSR plan already computed once. Serializing this node copies its stored
 * string directly — it allocates no ServerElement/ServerText, no attribute Map
 * and no children array for the collapsed subtree. The stored `html` is
 * produced by the exact same mount + serialize pipeline as the runtime path, so
 * the output is byte-identical (the v1.7 byte-identity gate proves this).
 *
 * This node is SSR-only: it is created solely via `ServerDOMAdapter.createRawHTML`
 * on the server render path and never appears in a browser build.
 */
declare class ServerRawHTML implements ServerNode {
    readonly kind: "raw";
    parent: ServerParent | null;
    readonly html: string;
    constructor(html: string);
}
declare class ServerElement implements ServerNode {
    readonly kind: "element";
    parent: ServerParent | null;
    readonly tagName: string;
    readonly attributes: Map<string, string>;
    readonly children: ServerNode[];
    _properties: Map<string, unknown> | null;
    _style: ServerStyle | null;
    constructor(tagName: string);
    /** JS properties set via `setProperty` (e.g. input `value`, `checked`). Allocated on first access. */
    get properties(): Map<string, unknown>;
    /** Inline-style holder mirroring `element.style`. Allocated on first access. */
    get style(): ServerStyle;
}
/** Escape text node content. */
declare function escapeHtmlText(value: string): string;
/** Escape a double-quoted attribute value. */
declare function escapeHtmlAttr(value: string): string;
/** Serialize a single server node (element/text/comment/fragment/raw) to HTML. */
declare function serializeServerNode(node: ServerNode): string;
/** Serialize the children of an element or fragment (its "inner HTML"). */
declare function serializeChildren(node: ServerElement | ServerFragment): string;

/**
 * Focus helpers built on the {@link DOMAdapter} abstraction.
 *
 * These are the minimal, genuinely-useful focus operations an app needs:
 * focus a specific element (e.g. the first field when a route or modal opens)
 * or focus the first focusable element inside a container (e.g. move focus
 * into a dialog). Both go through the adapter, so they are no-ops on the server
 * (`ServerDOMAdapter.querySelector` returns null / `focus` does nothing) and
 * therefore safe to call from universal code.
 */

/** Default selector for natively focusable / tabbable elements. */
declare const FOCUSABLE_SELECTOR = "a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex=\"-1\"])";
/**
 * Focus the element with the given id, scoped to `root`.
 * Returns true if an element was found and focused.
 */
declare function focusById(dom: DOMAdapter, root: Element | Document, id: string): boolean;
/**
 * Focus the first focusable element inside `container`.
 * Returns true if a focusable element was found and focused.
 */
declare function focusFirst(dom: DOMAdapter, container: Element | Document, selector?: string): boolean;
/**
 * Ordered list of focusable/tabbable descendants of `container`.
 * Re-checks each candidate against the selector so elements disabled after the
 * initial query (e.g. a button toggled to `disabled`) are excluded.
 */
declare function getFocusable(dom: DOMAdapter, container: Element, selector?: string): Element[];
/**
 * Capture the currently-focused element so it can be restored later (e.g. when
 * a dialog closes). Returns null on the server or when nothing is focused.
 */
declare function saveFocus(dom: DOMAdapter): Element | null;
/** Restore focus to a previously {@link saveFocus}-d element. No-op if null. */
declare function restoreFocus(dom: DOMAdapter, saved: Element | null): void;
/**
 * Move focus into `container` on open: the element with id `initialFocusId` if
 * given and present, otherwise the first focusable element. Server-safe no-op.
 */
declare function focusInitial(dom: DOMAdapter, container: Element, initialFocusId?: string): void;
/**
 * Trap Tab / Shift+Tab focus within `container` (wrap-around at both ends).
 * Attaches a keydown listener to the container and returns a cleanup function
 * that detaches it. Server-safe: `addEventListener` is a no-op, and the returned
 * cleanup is still callable.
 */
declare function trapFocus(dom: DOMAdapter, container: Element): () => void;
declare function containFocus(dom: DOMAdapter, container: Element): () => void;
/**
 * Invoke `handler` when Escape is pressed while focus is within `target`.
 * Returns a cleanup function. Server-safe no-op.
 */
declare function onEscape(dom: DOMAdapter, target: Element, handler: () => void): () => void;
/**
 * Roving-focus keyboard navigation for a menu (role="menu") container: the
 * arrow keys move focus between the container's focusable items (wrap-around at
 * both ends), Home/End jump to the first/last item, and Enter/Space activate
 * the currently-focused item (a native `click`, so an item's `onClick` fires).
 * `Tab` and `Escape` are deliberately left alone — the overlay layer wires
 * Escape-to-close separately and a menu does not trap Tab.
 *
 * Items are re-queried on every key (via {@link getFocusable}) so a menu whose
 * items change reactively is always navigated against the live set, and items
 * disabled after mount are skipped. Attaches a keydown listener to the
 * container and returns a cleanup function. Server-safe: `addEventListener` is
 * a no-op and the returned cleanup is still callable.
 */
declare function rovingMenu(dom: DOMAdapter, container: Element, selector?: string): () => void;

/**
 * ARIA live-region announcer (§15).
 *
 * Screen readers announce text that appears inside an `aria-live` region. The
 * naive approach — append a fresh `<div aria-live>` per message — leaks a
 * growing pile of stale nodes and (because a node inserted *already carrying*
 * its text is often not re-announced) is unreliable. This announcer instead
 * keeps exactly TWO persistent regions on `<body>` — one `polite`, one
 * `assertive` — and mutates their text to speak. Announcing clears the region
 * first and writes on a microtask so that repeating the same string still
 * triggers a DOM mutation the AT will pick up.
 *
 * Built entirely on the {@link DOMAdapter}, so it is server-safe: when
 * `dom.body()` is null (SSR / headless) construction returns an inert announcer
 * whose `announce`/`clear`/`destroy` are no-ops. There is never any SSR markup
 * for a live region — announcements are a runtime-only concept.
 */

interface Announcer {
    /**
     * Announce `message`. `assertive` (default false) routes to the assertive
     * region (interrupts the user) instead of the polite one (waits for a pause).
     */
    announce(message: string, options?: {
        assertive?: boolean;
    }): void;
    /** Clear both regions without announcing anything. */
    clear(): void;
    /** Remove both regions from the DOM. Idempotent. */
    destroy(): void;
}
/**
 * Create a live-region announcer bound to `dom`. Idempotent per call — each
 * call owns its own pair of regions, so an app that wants a single shared
 * announcer should create one and reuse it (and `destroy()` it on teardown).
 */
declare function createAnnouncer(dom: DOMAdapter): Announcer;

/**
 * Attribute and property application helpers.
 *
 * Decides whether a prop should be set as a DOM attribute or a JS property,
 * handling special cases (boolean attrs, event-like props, style, class).
 */

declare function applyProp(dom: DOMAdapter, element: Element, name: string, value: unknown): void;
declare function patchProp(dom: DOMAdapter, element: Element, name: string, oldValue: unknown, newValue: unknown): void;

/**
 * Event wiring for the renderer.
 *
 * Given a GraphNode with event descriptors, this wires DOM listeners
 * that call the handlers stored in the graph's handler registry.
 */

declare function wireEvents(dom: DOMAdapter, graph: ApplicationGraph, node: GraphNode, element: Element, instance: NodeInstance): void;

/**
 * Initial mount — creates DOM nodes for every GraphNode and
 * attaches them into the container.
 *
 * This is a recursive depth-first walk. For each GraphNode:
 *  1. Create the DOM element (or text node)
 *  2. Apply props/attributes
 *  3. Wire events
 *  4. Wire signal subscriptions for reactive props
 *  5. Recurse into children
 *  6. Insert into the DOM
 */

declare function mountGraph(ctx: RenderContext): NodeInstance;
declare function mountNode(ctx: RenderContext, graphNode: GraphNode, parentDom: Node): NodeInstance;
/**
 * Per-node-type reactive-binding factories. Each returns the `onUpdate`
 * callback that `wireSignalBindings` invokes when a bound signal changes.
 * Extracted so both the browser mount path and the hydration path apply the
 * exact same DOM mutation semantics for each prop — no duplicated rendering
 * logic.
 */
declare function textUpdate(dom: DOMAdapter, el: Element, textNode: Text): (propKey: string, value: unknown) => void;
declare function headingUpdate(dom: DOMAdapter, el: Element): (propKey: string, value: unknown) => void;
declare function inputUpdate(dom: DOMAdapter, el: Element): (propKey: string, value: unknown) => void;
declare function buttonUpdate(dom: DOMAdapter, el: Element): (propKey: string, value: unknown) => void;
declare function linkUpdate(dom: DOMAdapter, el: Element): (propKey: string, value: unknown) => void;
declare function applyNodeProps(ctx: RenderContext, graphNode: GraphNode, el: Element): void;
declare function wireSignalBindings(ctx: RenderContext, graphNode: GraphNode, instance: NodeInstance, onUpdate: (propKey: string, value: unknown) => void): void;
/**
 * Subscribe a reactive-list instance to its driving signal. On each change the
 * DSL-registered plan factory produces lightweight per-row descriptors, which
 * are reconciled against the live DOM with the keyed, minimal-move reconciler
 * (spec §15). A `conditional` node has no plan handler and falls back to the
 * eager build factory (it only ever renders 0..1 branch, so eager is fine).
 */
declare function wireReactiveList(ctx: RenderContext, graphNode: GraphNode, instance: NodeInstance, el: Element, runAppear?: boolean): void;
/**
 * Attach overlay focus/keyboard behavior to a mounted portal. Server-safe: on
 * the server `dom.body()` is null so this returns immediately (SSR emits inert
 * markup, no focus concept). A plain portal has no `__overlay__` descriptor, so
 * this also returns immediately — the behavior is purely additive.
 *
 * The panel is mounted/unmounted by the portal's inner `when(open, …)`, whose
 * signal subscription is registered *before* this one (the conditional child is
 * mounted earlier in the portal branch). Signal subscribers fire synchronously
 * in subscription order, so on open→true the panel DOM exists before we move
 * focus into it, and on open→false the panel is torn down before we restore
 * focus. All listeners are tracked on the instance and torn down on unmount.
 */
declare function wireOverlayBehavior(ctx: RenderContext, graphNode: GraphNode, instance: NodeInstance, target: Element): void;
/**
 * Wire a component instance's lifecycle (§9). Reads the optional
 * `__component__<id>` descriptor — an array of teardown callbacks the DSL's
 * `component()` collected from the setup's `ctx.effect`/`ctx.onCleanup` — and
 * routes each into `NodeInstance.trackCleanup`, so they run (children-first)
 * when the component leaves the graph. Shared by the mount and hydrate paths so
 * both attach identical ownership. A `'component'` node with no cleanups (no
 * effects/resources) registers no descriptor and this is a no-op.
 */
declare function wireComponentBehavior(ctx: RenderContext, graphNode: GraphNode, instance: NodeInstance): void;

/**
 * Patch — targeted DOM updates driven by signal changes.
 *
 * When a signal fires, we look up the NodeInstance and apply
 * only the changed prop — no full re-render, no tree diffing.
 */

declare function patchNode(ctx: RenderContext, graphNode: GraphNode, propKey: string, newValue: unknown): void;

/**
 * CSS class-based enter/leave transition controller (§2–§8).
 *
 * This is the browser-only runtime that consumes the `__transition__<nodeId>`
 * descriptor the DSL registers (a pre-resolved {@link ResolvedTransitionLike}).
 * It is deliberately structural about that descriptor — like the renderer's
 * `__overlay__`/`__component__` handling — so the renderer takes NO compile-time
 * dependency on the DSL package.
 *
 * Engine (confirmed decision): CSS classes, no Web Animations API, no
 * browser-only API referenced at module scope. Every timer / rAF / event
 * binding is reached lazily through `globalThis` and only ever runs when
 * `dom.body() !== null` (the same SSR guard `wireOverlayBehavior` uses), so:
 *   - server output is byte-identical (nothing here runs during SSR — §21);
 *   - happy-dom, which dispatches no `transitionend`/`animationend`, still
 *     completes deterministically via the fallback timeout (§24).
 *
 * The controller is created once per reactive container instance (reactive-list
 * or conditional) so its `leaving` map survives across reconcile passes — that
 * is what makes leave→enter reclaim (§6) and keyed-identity list leave (§7)
 * correct.
 */

/**
 * The renderer's structural view of the resolved transition the DSL stores in
 * `__transition__<id>`. Mirrors `streetui`'s `ResolvedTransition` without
 * importing it (no renderer→dsl dependency).
 */
interface ResolvedTransitionLike {
    readonly enterActive: readonly string[];
    readonly enterFrom: readonly string[];
    readonly enterTo: readonly string[];
    readonly leaveActive: readonly string[];
    readonly leaveFrom: readonly string[];
    readonly leaveTo: readonly string[];
    readonly appear: boolean;
    readonly duration: number;
}
/**
 * Hooks handed to the reconciler so it can (a) reclaim an instance that is
 * mid-leave when its key re-enters (leave→enter cancellation), (b) defer the
 * remove/dispose/forget/detach chain for a leaving instance until its animation
 * ends, and (c) play the enter animation for a freshly-inserted instance. When
 * no transition applies (or we are on the server) every hook degrades to the
 * pre-transition synchronous behaviour.
 */
interface TransitionHooks {
    /**
     * If an instance for `key` is currently animating out, cancel its leave and
     * return it for reuse; otherwise undefined. The caller re-mounts nothing and
     * reuses the returned instance's live DOM node.
     */
    takeLeaving(key: string): NodeInstance | undefined;
    /**
     * Begin a leave animation for a removed instance. Returns true when the whole
     * teardown chain has been deferred to animation-end (caller must NOT remove,
     * dispose, forget or detach it), or false when there is no transition / no
     * browser and the caller should tear it down synchronously as before.
     */
    beginLeave(inst: NodeInstance): boolean;
    /** Play the enter animation for a freshly-inserted (or reclaimed) instance. */
    onEnter(inst: NodeInstance): void;
}
/** Read the pre-resolved transition descriptor for a node, if any. */
declare function getResolvedTransition(graph: ApplicationGraph, nodeId: string): ResolvedTransitionLike | undefined;
/** Which half of a transition to play on a bare element. */
type TransitionPhase = 'enter' | 'leave';
/**
 * Play one enter/leave transition on a bare DOM element, outside the keyed
 * reconciler — the seam the router uses for route leave/enter (§9) and any other
 * consumer that owns a single host element rather than a reactive container.
 *
 * Reuses the exact same {@link startRun} mechanics as list/conditional
 * transitions (from+active applied immediately, next-frame flip to `to`,
 * completion on transitionend/animationend or the fallback timer), so there is
 * one transition engine, not two. The returned handle's `cancel()` settles the
 * run immediately WITHOUT invoking `onDone` — the caller uses it to abort an
 * in-flight enter when the same host is about to start leaving (rapid
 * navigation), avoiding overlapping runs/duplicate listeners on one element.
 *
 * On the server (or any non-element target) there is nothing to animate, so
 * `onDone` runs synchronously and `cancel()` is a no-op — the caller's teardown
 * still happens exactly once.
 */
declare function runElementTransition(dom: DOMAdapter, el: Element, rt: ResolvedTransitionLike, phase: TransitionPhase, onDone: () => void): {
    cancel(): void;
};
/**
 * Per-container transition controller. One instance is created for each
 * reactive-list / conditional NodeInstance in {@link wireReactiveList}; its
 * `leaving` map persists across every reconcile of that container.
 */
declare class TransitionController {
    private readonly dom;
    private readonly graph;
    /** Full teardown of a leaving instance (remove + dispose + forget + detach). */
    private readonly finalize;
    private readonly leaving;
    constructor(dom: DOMAdapter, graph: ApplicationGraph, 
    /** Full teardown of a leaving instance (remove + dispose + forget + detach). */
    finalize: (inst: NodeInstance) => void);
    /** True only in a real DOM environment (browser). */
    private get browser();
    private keyOf;
    private resolved;
    /** Run the enter animation for `inst` if it carries a transition (browser only). */
    enter(inst: NodeInstance): void;
    /**
     * Play `appear` for any initial child that opted into it (fresh browser mount
     * only — hydration must never animate appear, §22, and this is called only on
     * the mount path).
     */
    appear(children: readonly NodeInstance[]): void;
    hooks(): TransitionHooks;
}

/**
 * Reconciliation — diff-based child list updates.
 *
 * When the children of a node change (e.g. a list driven by state),
 * this reconciler:
 *  1. Matches old instances to new graph nodes by key
 *  2. Reuses matched instances (updates their props)
 *  3. Applies a targeted content update to a reused item whose data changed
 *  4. Creates new instances for additions
 *  5. Removes stale instances (and prunes their handler registrations)
 *  6. Moves DOM nodes to match new order
 *
 * This is keyed reconciliation over the semantic graph — there is no virtual
 * DOM. A reused item keeps its own DOM element; only its changed content is
 * updated in place (falling back to remounting a subtree only where its shape
 * actually changed).
 */

type MountFn = (node: GraphNode, parent: Element) => NodeInstance;
interface ReconcileResult {
    /** Instances in the new order. */
    instances: NodeInstance[];
    /** Instances that were removed and must be disposed. */
    removed: NodeInstance[];
    /**
     * GraphNodes freshly materialised during this reconcile (new rows + rebuilt
     * changed rows). The caller detaches any of these that were not adopted as a
     * live instance's graph node, so no orphan subtree lingers in the graph index.
     */
    built?: GraphNode[];
}
/**
 * A lazy reconciliation descriptor for one reactive-list row (mirrors the DSL's
 * `ListPlanEntry`). `sig()` and `build()` are only invoked for rows that are
 * genuinely new or whose source reference changed — the whole point of the
 * plan path (spec §15).
 */
interface PlanEntry {
    readonly key: string;
    readonly item: unknown;
    readonly sig: () => string;
    readonly build: () => GraphNode;
}
/**
 * Reconcile children of a container element against a new list of graph nodes.
 *
 * @param ctx         Render context
 * @param parentDom   The DOM parent element
 * @param oldInstances Current child instances (in order)
 * @param newNodes    New graph children (in desired order)
 * @param mountFn     Factory to create a new NodeInstance for a graph node
 */
declare function reconcileChildren(ctx: RenderContext, parentDom: Element, oldInstances: NodeInstance[], newNodes: readonly GraphNode[], mountFn: MountFn, hooks?: TransitionHooks): ReconcileResult;
/**
 * Plan-based keyed reconciliation (spec §15 — the optimised reactive-list path).
 *
 * Identical observable result to {@link reconcileChildren}, but driven by lazy
 * {@link PlanEntry} descriptors instead of a pre-built array of GraphNodes:
 *
 *  - a reused row whose `item` reference is unchanged does **zero** work — no
 *    signature hash, no subtree build, no prop patch (the common case for
 *    append / prepend / remove / reorder / reverse, where existing item objects
 *    keep their identity);
 *  - a reused row whose reference changed hashes lazily and, only on a real
 *    signature change, materialises a fresh subtree for a targeted in-place
 *    content update;
 *  - a genuinely new key builds + mounts exactly one subtree.
 *
 * DOM reordering uses a longest-increasing-subsequence pass so the number of
 * moves is minimal (e.g. a prepend into a 10k list moves 1 node, not 10k).
 */
declare function reconcileChildrenByPlan(ctx: RenderContext, parentDom: Element, oldInstances: NodeInstance[], plan: readonly PlanEntry[], mountFn: MountFn, hooks?: TransitionHooks): ReconcileResult;

/**
 * StreetUI styling — transition engine interop presets (§18).
 *
 * These helpers return a {@link ResolvedTransitionLike} — the exact descriptor the
 * existing transition engine consumes — assembled entirely from token-driven
 * `style()` classes and the `--duration-*` / `--easing-*` tokens. Styling therefore
 * *integrates with* the transition engine rather than competing with it: it only
 * supplies the enter/leave appearance classes the engine toggles; the engine still
 * owns all lifecycle timing, leave-deferral and keyed-identity reclaim (§18).
 * StreetUI adds no new timer and no second animation system here — the browser
 * performs the interpolation via CSS, and the engine's single timeout coordinates
 * DOM removal.
 */

interface TransitionPresetOptions {
    /** Duration token key driving both the CSS transition and the engine timeout. */
    readonly duration?: DurationKey;
    /** Easing token key for the CSS transition. */
    readonly easing?: EasingKey;
    /** Play the enter animation on first mount too (default `false`). */
    readonly appear?: boolean;
}
/** A cross-fade enter/leave transition descriptor for the transition engine. */
declare function fadeTransition(opts?: TransitionPresetOptions): ResolvedTransitionLike;
/** A fade + scale "pop" transition descriptor (opacity and transform). */
declare function scaleTransition(opts?: TransitionPresetOptions): ResolvedTransitionLike;
/** A fade + vertical-slide transition descriptor (enters from below). */
declare function slideTransition(opts?: TransitionPresetOptions): ResolvedTransitionLike;
/** The token-driven transition presets (§18), for use with the transition engine. */
declare const transitions: {
    readonly fadeTransition: typeof fadeTransition;
    readonly scaleTransition: typeof scaleTransition;
    readonly slideTransition: typeof slideTransition;
};

/**
 * StreetUI styling — SSR stylesheet emission + hydration adoption (§15–§17).
 *
 * This is the exact companion to `renderHead` (head.ts): where the head runtime
 * serializes merged `head()` contributions into `<head>`, this serializes the
 * process-wide deduplicated CSS rule registry into a single
 * `<style data-streetui-css>` block for the caller to place in `<head>`.
 *
 *   • `renderStyles()` — SERVER. Serializes `styleRegistry` in deterministic band
 *     order (tokens → base → responsive → state → variant) and stamps the block
 *     with `data-streetui-css-keys="<id> <id> …"` so the browser can adopt the
 *     identities on hydration instead of re-emitting duplicate rules (§17).
 *     Returns `''` when the registry is empty — so an app that declares no styles
 *     (and no token block) emits nothing extra and existing SSR output stays
 *     byte-identical (§16, the empty-registry guarantee).
 *
 *   • `adoptServerStyles(dom, root)` — BROWSER. Finds the server-emitted style
 *     block under `root` (or `document`), reads its identity keys, and seeds the
 *     registry via `adoptServerIdentities` so client-side `style()`/token calls
 *     for the same identities register no duplicate rule (§17).
 *
 * CSS is inherently global and cascading, so — unlike head — the stylesheet is
 * the whole process registry (a deduped superset), not a per-graph walk. The
 * registry is keyed by content identity and never by node, so it is bounded by
 * source diversity and strands nothing when nodes unmount (§15, leak-free).
 */

interface RenderStylesOptions {
    /** Registry to serialize (defaults to the shared process-wide instance). */
    readonly registry?: StyleRegistry;
}
/**
 * Serialize the deduplicated CSS registry to a `<style data-streetui-css>` block
 * for placement inside `<head>`. Deterministic and byte-stable: an empty registry
 * yields `''` (§16); otherwise the single block carries every registered rule in
 * fixed band order plus the identity list for hydration adoption (§17).
 */
declare function renderStyles(options?: RenderStylesOptions): string;
/**
 * Adopt a server-emitted stylesheet's identities into the registry so the client
 * does not re-emit duplicate rules for the same styles (§17). Safe to call when
 * no server block exists (no-op) and idempotent. Returns the number of identities
 * adopted (0 when there was nothing to adopt).
 */
declare function adoptServerStyles(dom: DOMAdapter, root: Element | null, options?: RenderStylesOptions): number;

/**
 * StreetUI styling — first-class, SSR/hydration-safe theme controller (§7).
 *
 * Theme is ordinary StreetUI state: a signal for the user's choice and a derived
 * signal for the resolved concrete theme. The only browser-specific parts —
 * reading a stored preference, matching the OS color scheme, and writing the
 * `data-theme` attribute onto a root element — are isolated behind guards so the
 * exact same module runs during SSR (no `document`, no `localStorage`) without
 * throwing. The server renders with the default theme; the client applies the
 * persisted/system choice on mount, which is a legitimate post-hydration update
 * rather than a hydration mismatch: the attribute lives on the root element,
 * outside the hydrated app container, and only re-points token variables (§16).
 *
 * This lives in the renderer layer because switching the theme writes to the DOM;
 * it builds on the DOM-free token system in `streetui` (`createThemeTokens`
 * emits `:root` + `[data-theme="dark"]` variable blocks), so a theme flip is a
 * single attribute change with no restyle work and no re-render.
 */

type ThemeChoice = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';
/** Minimal persistence seam so tests/SSR can run without a real localStorage. */
interface ThemeStorage {
    read(): ThemeChoice | null;
    write(choice: ThemeChoice): void;
}
/** Browser localStorage adapter, guarded; falls back to in-memory elsewhere. */
declare function defaultThemeStorage(key?: string): ThemeStorage;
interface ThemeController {
    /** The user's choice: light | dark | system. */
    readonly choice: Signal<ThemeChoice>;
    /** The resolved concrete theme after applying `system`. */
    readonly resolved: ReadonlySignal<ResolvedTheme>;
    /** Set an explicit choice (persisted). */
    set(choice: ThemeChoice): void;
    /** Advance light → dark → system → light (for a single toggle control). */
    cycle(): void;
    /** Human label for the current choice (bind to the toggle button). */
    readonly label: ReadonlySignal<string>;
    /** Stop applying the theme to the DOM (disposes the effect). */
    dispose(): void;
}
interface ThemeOptions {
    readonly storage?: ThemeStorage;
    /** Element to receive `data-theme` (defaults to the document root). Omit for SSR. */
    readonly root?: Element | null;
    /** Initial choice when nothing is stored (default 'system'). */
    readonly initial?: ThemeChoice;
}
/**
 * Create the theme controller. During SSR pass no `root` (or it will be null);
 * the signal still works so server markup can read `resolved`, but no DOM write
 * is attempted. Reactive theme switching is a single `data-theme` flip (§7/§16).
 */
declare function createTheme(options?: ThemeOptions): ThemeController;

/**
 * StreetUI Renderer — framework-owned DOM renderer.
 *
 * No React. No Vue. No virtual-dom. No external rendering library.
 *
 * Pipeline:
 *   CompiledApplication
 *     → mountGraph (creates all DOM nodes)
 *     → signal subscriptions drive patchNode (targeted updates)
 *     → flush() propagates any pending scheduler jobs
 *     → unmount() disposes everything
 */

interface StreetRendererOptions {
    /** Override the DOM adapter (e.g. for testing). Defaults to BrowserDOMAdapter. */
    readonly domAdapter?: DOMAdapter;
    /**
     * Optional dev-only sink that observes hydration mismatch repairs. Attach one
     * to surface server/client divergences during development; leave it unset in
     * production so hydration does no extra work.
     */
    readonly hydrationDiagnostics?: HydrationDiagnosticSink;
}
declare class StreetRendererImpl implements StreetRenderer {
    private readonly _dom;
    private readonly _hydrationDiagnostics?;
    constructor(options?: StreetRendererOptions);
    mount(compiled: CompiledApplication, container: Element): RenderHandle;
    /**
     * Hydrate a container that already holds server-rendered HTML for this
     * application. Instead of recreating the DOM, it walks the semantic graph
     * against the existing nodes, adopting matching elements and attaching
     * behavior (events + signal subscriptions). Mismatched subtrees are locally
     * replaced. Returns the same handle type as `mount`.
     */
    hydrate(compiled: CompiledApplication, container: Element): RenderHandle;
    private _wireSignals;
}
/**
 * Create the default StreetUI renderer using the browser's DOM APIs.
 */
declare function createRenderer(options?: StreetRendererOptions): StreetRendererImpl;

/**
 * StreetRenderHandle — the live handle returned by both `mount` and `hydrate`.
 *
 * Owns teardown for a mounted/hydrated application: disposes every NodeInstance
 * (removing event listeners and signal subscriptions) and clears the container
 * through the DOM adapter (never raw browser globals), so the same handle works
 * for browser and — in principle — server-driven teardown.
 */

declare class StreetRenderHandle implements RenderHandle {
    private _disposed;
    private readonly _ctx;
    private readonly _rootInstance;
    constructor(ctx: RenderContext, rootInstance: NodeInstance);
    flush(): void;
    unmount(): void;
}

/**
 * Hydration — attach a live StreetUI runtime to server-rendered HTML.
 *
 * `hydrate` walks the semantic application graph top-down against the DOM that
 * the server already produced. For every graph node it *adopts* the matching
 * existing element (creating a `NodeInstance` that points at it) and attaches
 * behavior — event listeners and signal subscriptions — using the exact same
 * helpers the browser mount path uses (`wireEvents`, `wireSignalBindings`,
 * `wireReactiveList`, and the per-type update factories). Nothing is recreated
 * when the DOM matches.
 *
 * Matching is positional and works because every non-application graph node
 * maps to exactly one element (see mount.ts). When the element at a position
 * does not match the expected tag (or is missing), only that subtree is
 * repaired: the fresh subtree is mounted and spliced into place, leaving the
 * rest of the hydrated tree untouched. A local mismatch never tears down the
 * whole app.
 */

/** Hydrate the whole application graph against `ctx.container`. */
declare function hydrateGraph(ctx: RenderContext): NodeInstance;

/**
 * Maps semantic node types to HTML tag names.
 */

declare function resolveTag(type: SemanticNodeType): string;

/**
 * StreetUI Router — public type surface.
 *
 * The router sits ABOVE the DSL/compiler/runtime/renderer and composes them.
 * It introduces no new rendering path and no second reactive system: route
 * state is a StreetUI `signal`, route cleanup reuses the core `CleanupRegistry`,
 * and each route renders as an ordinary compiled StreetUI application tree.
 */

/**
 * Context handed to a route builder when its route becomes active.
 *
 * `params` are the values captured from dynamic segments (`/users/:id`),
 * `query` is the parsed query string, and `onCleanup` registers work to run
 * when the router navigates away from this route (subscriptions, effects,
 * timers). It is backed by a route-scoped `CleanupRegistry` — there is no
 * separate cleanup mechanism.
 */
interface RouteContext {
    /** Full matched pathname, e.g. `/users/123`. */
    readonly path: string;
    /** The route pattern that matched, e.g. `/users/:id` or `*`. */
    readonly pattern: string;
    /** Dynamic segment values captured from the path. */
    readonly params: Readonly<Record<string, string>>;
    /** Parsed query string (everything after `?`). */
    readonly query: URLSearchParams;
    /** Register a callback to run when navigating away from this route. */
    onCleanup(fn: () => void): void;
}
/** Builds a route's page tree. Receives the page scope and the route context. */
type RouteBuilder = (page: PageDSL, ctx: RouteContext) => void;
/** A single route: a path pattern and the builder that renders it. */
interface RouteDefinition {
    /**
     * Path pattern. Supports:
     *  - static segments:      `/`, `/docs`, `/docs/getting-started`
     *  - dynamic `:param`:     `/users/:id`
     *  - catch-all wildcard:   `*` (matches anything — use for a 404 route)
     */
    readonly path: string;
    readonly builder: RouteBuilder;
}
/** The result of resolving a location against the route table. */
interface RouteMatch {
    /** The active pathname (no query string). */
    readonly path: string;
    /** The pattern of the matched route. */
    readonly pattern: string;
    /** Captured dynamic params. */
    readonly params: Readonly<Record<string, string>>;
    /** Parsed query string. */
    readonly query: URLSearchParams;
    /** The route definition that produced this match. */
    readonly route: RouteDefinition;
    /** True when this match came from the wildcard catch-all (`*`) — i.e. a 404. */
    readonly isFallback: boolean;
}

/**
 * Route matching — pure functions, no DOM, no reactivity.
 *
 * A pattern is matched segment-by-segment against a pathname:
 *  - a literal segment must equal the path segment,
 *  - a `:name` segment captures the path segment into `params.name`,
 *  - a `*` segment (or a whole-pattern `*`) is a catch-all that matches the
 *    remainder of the path and captures it into `params['*']`.
 *
 * Matching is intentionally small: no optional segments, no regex constraints,
 * no nested route trees. Composition of layouts is done in the DSL, not here.
 */
/** Normalize a pathname: ensure a single leading slash, drop a trailing slash. */
declare function normalizePath(path: string): string;
/**
 * Try to match a single pattern against a pathname.
 * Returns the captured params on success, or `null` on no match.
 */
declare function matchPattern(pattern: string, pathname: string): Record<string, string> | null;
interface MatchResult<R> {
    readonly route: R;
    readonly params: Record<string, string>;
}
/**
 * Match a pathname against an ordered list of routes. The first route whose
 * pattern matches wins (definition order), so more specific routes should be
 * listed before a `*` fallback.
 */
declare function matchRoutes<R extends {
    path: string;
}>(routes: readonly R[], pathname: string): MatchResult<R> | null;
/** Split a `to` target into its pathname and (already-stripped) search string. */
declare function splitTarget(to: string): {
    pathname: string;
    search: string;
};

/**
 * Router history — a small abstraction over the navigation source so the router
 * can run both in the browser (real `window.history` + `popstate`) and in tests
 * (an in-memory stack, fully deterministic, no globals).
 *
 * Internal navigation never triggers a full-page reload: the browser history
 * uses `pushState`/`replaceState` and notifies listeners synchronously.
 */
interface RouterLocation {
    /** Pathname, always normalized with a single leading slash. */
    readonly pathname: string;
    /** Query string without the leading `?`. */
    readonly search: string;
}
interface RouterHistory {
    /** The current location. */
    location(): RouterLocation;
    /** Push a new entry and notify listeners. */
    push(pathname: string, search: string): void;
    /** Replace the current entry and notify listeners. */
    replace(pathname: string, search: string): void;
    /** Go back one entry. */
    back(): void;
    /** Go forward one entry. */
    forward(): void;
    /** Subscribe to location changes. Returns an unsubscribe function. */
    listen(cb: () => void): () => void;
    /** Detach any global listeners (browser only). */
    dispose(): void;
}
/**
 * Browser history backed by `window.history`. `pushState`/`replaceState` do not
 * emit `popstate`, so we notify listeners ourselves after those calls; genuine
 * back/forward navigation arrives via the `popstate` event.
 */
declare function createBrowserHistory(): RouterHistory;
/**
 * In-memory history for tests and non-DOM environments. Maintains an explicit
 * stack and cursor so `back()`/`forward()` are deterministic.
 */
declare function createMemoryHistory(initial?: string): RouterHistory;

/**
 * StreetUI Router core — renderer-agnostic.
 *
 * Holds the route table, resolves the current location into a `RouteMatch`,
 * and exposes that match as a StreetUI `signal`. Navigation is delegated to a
 * `RouterHistory`; when the location changes (via `navigate`, `back`, `forward`,
 * or a browser `popstate`) the router recomputes the match and updates the
 * signal, which is how every consumer (`isActive`, the mount integration, any
 * `derived` the app builds) stays in sync. No second reactive system.
 */

interface RouterOptions {
    /** The route table. Order matters — the first matching pattern wins. */
    readonly routes: readonly RouteDefinition[];
    /**
     * Navigation source. Defaults to a browser history. Pass a memory history
     * for tests or non-DOM environments.
     */
    readonly history?: RouterHistory;
    /**
     * Fallback route used when nothing else matches and no `*` route is present.
     * Defaults to a built-in 404 page (a normal StreetUI tree — no special path).
     */
    readonly notFound?: RouteDefinition;
}
interface NavigateOptions {
    /** Replace the current history entry instead of pushing a new one. */
    readonly replace?: boolean;
}
interface IsActiveOptions {
    /** Require an exact pathname match rather than a prefix match. */
    readonly exact?: boolean;
}
interface Router {
    /** Reactive current match. Consumers subscribe via StreetUI signals. */
    readonly currentRoute: ReadonlySignal<RouteMatch>;
    /** Navigate to a target path (may include a query string). */
    navigate(to: string, options?: NavigateOptions): void;
    /** Go back one history entry. */
    back(): void;
    /** Go forward one history entry. */
    forward(): void;
    /** Reactive predicate: is `path` the active route (or a prefix of it)? */
    isActive(path: string, options?: IsActiveOptions): ReadonlySignal<boolean>;
    /** Tear down history listeners. */
    destroy(): void;
}
declare function createRouter(options: RouterOptions): Router;

/**
 * StreetUI Router — DOM integration.
 *
 * `mountRouter` wires a `Router` to real DOM:
 *
 *   1. Mounts an optional persistent shell (layout + navigation) ONCE. The shell
 *      declares an outlet element (see `routerOutlet`) into which route content
 *      is rendered.
 *   2. Subscribes to `router.currentRoute`. On every change it disposes the
 *      previous route (route-scoped `CleanupRegistry.run()` + `runtime.unmount()`)
 *      and mounts the new route's compiled application into the outlet.
 *      Only the outlet subtree is re-created — the shell persists.
 *   3. Intercepts clicks on internal `<a>` elements for client-side navigation.
 *      External links (absolute URLs, `target="_blank"`, `mailto:`/`tel:`) keep
 *      their normal browser behaviour, and `link()` is used unchanged.
 *
 * Each route is an ordinary compiled StreetUI application — no special renderer
 * path, no virtual DOM, no full-application rerender on navigation.
 */

/** Default id used for the route outlet element inside a shell. */
declare const ROUTER_OUTLET_ID = "streetui-router-outlet";
/**
 * Stable reconciliation KEY of the outlet container `routerOutlet` emits.
 *
 * Hydration adoption is keyed on node identity, so a server render that fills
 * the outlet inline must emit its container with THIS key (and a matching id)
 * for the client to adopt the server node instead of silently recreating the
 * subtree. Exposed so SSR code references one symbol rather than restating the
 * `'router-outlet'` literal — the outlet contract then has a single source of
 * truth for both the key and (via {@link ROUTER_OUTLET_ID}) the default id.
 */
declare const ROUTER_OUTLET_KEY = "router-outlet";
/**
 * Declare the route outlet inside a shell builder. The router replaces this
 * element's contents on every navigation.
 */
declare function routerOutlet(scope: ContainerDSL, id?: string): void;
type ShellBuilder = (shell: PageDSL, router: Router) => void;
interface MountRouterOptions {
    /** Element to mount into. With a shell, the shell fills this; otherwise routes do. */
    readonly container: Element;
    /** Optional persistent layout. Must include a `routerOutlet(...)`. */
    readonly shell?: ShellBuilder;
    /** Id of the outlet element within the shell. Defaults to `ROUTER_OUTLET_ID`. */
    readonly outletId?: string;
    /** Override the renderer (e.g. a custom DOM adapter for tests). */
    readonly renderer?: StreetRenderer;
    /** Intercept internal `<a>` clicks for client-side navigation. Defaults to true. */
    readonly interceptLinks?: boolean;
    /**
     * Hydrate server-rendered HTML already present in the container instead of
     * mounting fresh. The shell and the *initial* route adopt the existing DOM;
     * subsequent client-side navigations mount normally. Defaults to false.
     */
    readonly hydrate?: boolean;
    /**
     * Optional enter/leave transition played on client-side navigations (§9). When
     * set, each navigation mounts the incoming route into its own host wrapper,
     * plays the enter animation on it, and defers the outgoing route's disposal
     * (route-scoped cleanup + DOM removal) until its leave animation ends — so
     * resources stay alive exactly as long as the departing DOM. History is
     * untouched (the router already navigated), and the initial mount/hydration is
     * NOT animated (§22-style: the first paint must match the server). Reuses the
     * single CSS-class transition engine — no second animation system.
     */
    readonly transition?: TransitionConfig;
}
interface MountedRouter {
    /** The element route content is rendered into. */
    readonly outlet: Element;
    /** Tear down the current route, the shell, link interception and the router. */
    unmount(): void;
}
declare function mountRouter(router: Router, options: MountRouterOptions): MountedRouter;

/**
 * A small, sync validation system.
 *
 * A `Validator` maps a string field value to an error message, or `undefined`
 * when the value is acceptable. This is deliberately tiny — the built-ins cover
 * the common cases (`required`, `minLength`, `maxLength`, `email`, `pattern`)
 * and anything else is just a plain function `(value: string) => string | undefined`.
 *
 * Validators for a field run in order and the FIRST error wins, so list
 * `required` first if a field is mandatory.
 *
 * Async validation is intentionally NOT part of this core. It can be layered on
 * top with `streetui`'s `resource()` (kick off a resource on value
 * change and surface `resource.error` alongside the field error) without
 * destabilising the synchronous validity model here.
 */
type Validator = (value: string) => string | undefined;
/** Fails when the trimmed value is empty. */
declare function required(message?: string): Validator;
/** Fails when the value is shorter than `length` characters. */
declare function minLength(length: number, message?: string): Validator;
/** Fails when the value is longer than `length` characters. */
declare function maxLength(length: number, message?: string): Validator;
/** Fails when a non-empty value is not a plausible email address. */
declare function email(message?: string): Validator;
/** Fails when a non-empty value does not match `regex`. */
declare function pattern(regex: RegExp, message?: string): Validator;
/** Run a validator (or ordered list) and return the first error, if any. */
declare function runValidators(value: string, validators: Validator | ReadonlyArray<Validator> | undefined): string | undefined;

/**
 * Reactive form model built entirely on `streetui` signals.
 *
 * There is no second state system here: every piece of form state (`values`,
 * `errors`, `touched`, `dirty`, `valid`, submission status) is a signal or a
 * derived signal, so it composes with the renderer's existing reactive bindings.
 * A field's `value` is a writable `Signal<string>`, which plugs straight into
 * the DSL's `input({ bind })` — typing updates form state and programmatic
 * updates update the input, through the one binding the renderer already wires.
 */

/** Form values are a flat, typed record of string fields (HTML input values). */
type FormValues = Record<string, string>;
interface Field {
    readonly name: string;
    /** Writable value signal — pass to `input({ bind: field.value })`. */
    readonly value: Signal<string>;
    /** Current validation error, or `undefined` when the field is valid. */
    readonly error: ReadonlySignal<string | undefined>;
    /** True once the field has received a genuine user interaction. */
    readonly touched: ReadonlySignal<boolean>;
    /** True when the value differs from its initial value. */
    readonly dirty: ReadonlySignal<boolean>;
    /** True when the field has no validation error. */
    readonly valid: ReadonlySignal<boolean>;
    /** Programmatically set the value (does not mark the field touched). */
    setValue(next: string): void;
    /** Force the touched flag (defaults to true). */
    markTouched(touched?: boolean): void;
    /** Restore this field's initial value and clear its touched flag. */
    reset(): void;
}
type FormValidators<T extends FormValues> = {
    readonly [K in keyof T]?: Validator | ReadonlyArray<Validator>;
};
interface FormConfig<T extends FormValues> {
    readonly initialValues: T;
    readonly validators?: FormValidators<T>;
    /** Called by `submit()` once all fields are valid. May be async. */
    readonly onSubmit?: (values: T) => void | Promise<void>;
}
type SubmitStatus = 'idle' | 'submitting' | 'success' | 'error';
interface Form<T extends FormValues> {
    readonly values: ReadonlySignal<T>;
    readonly errors: ReadonlySignal<Partial<Record<keyof T, string>>>;
    readonly touched: ReadonlySignal<Partial<Record<keyof T, boolean>>>;
    readonly dirty: ReadonlySignal<boolean>;
    readonly valid: ReadonlySignal<boolean>;
    readonly submitting: ReadonlySignal<boolean>;
    readonly submitted: ReadonlySignal<boolean>;
    readonly status: ReadonlySignal<SubmitStatus>;
    readonly submitError: ReadonlySignal<unknown>;
    /** Access the reactive state + setters for one field. */
    field<K extends keyof T & string>(name: K): Field;
    /** Merge a partial set of values in (does not mark fields touched). */
    setValues(partial: Partial<T>): void;
    /** Validate, mark all fields touched, then run `onSubmit` if valid. */
    submit(): Promise<void>;
    /** Restore initial values and clear errors/touched/dirty/submission state. */
    reset(): void;
    /** Tear down all field subscriptions and derived signals. */
    dispose(): void;
}
declare function createForm<T extends FormValues>(config: FormConfig<T>): Form<T>;

/**
 * streetui — build-time provider/consumer scoping.
 *
 * StreetUI builds its semantic tree synchronously, top-down, when the DSL
 * builders run. A `Context` mirrors that shape: `provide(value, run)` pushes a
 * value for the duration of the synchronous `run()` (during which the child
 * DSL builders execute and may `consume()`), then pops it. Consumers resolve
 * the *nearest* enclosing provider, falling back to the context default.
 *
 * This is deliberately NOT a second reactive system. A context value can be a
 * signal (see streetui); reactivity then belongs to that signal and is
 * torn down by the normal node lifecycle when the consuming subtree unmounts —
 * the context itself holds no subscriptions and leaves no refs behind after a
 * `provide()` call returns.
 */
interface Context<T> {
    /** Unique identity for this context (useful for debugging/inspection). */
    readonly id: symbol;
    /** The value returned by {@link consume} when no provider is active. */
    readonly defaultValue: T;
    /**
     * Provide `value` to any `consume()` calls made synchronously inside `run`.
     * The value is popped again as soon as `run` returns (even if it throws),
     * so nesting resolves to the nearest active provider.
     */
    provide<R>(value: T, run: () => R): R;
    /** Read the nearest active provider's value, or {@link defaultValue}. */
    consume(): T;
    /** True while at least one provider is active for this context. */
    hasProvider(): boolean;
}
/**
 * Create a typed context with a required default value, so `consume()` always
 * returns a `T` (never `undefined` unless `T` itself permits it).
 */
declare function createContext<T>(defaultValue: T, description?: string): Context<T>;

/**
 * Minimal, framework-native internationalization for StreetUI.
 *
 * Built entirely on `streetui` signals — there is no second reactive
 * system. The active locale is a writable signal; `t()` returns a derived
 * signal that recomputes when the locale changes, so translations plug
 * straight into the DSL's reactive text bindings (`text(() => i18n.t(...).get())`
 * or `text(i18n.t(...))`).
 *
 * Translation is deterministic: a missing key resolves to the key itself, and
 * the same (locale, key, params) always produces the same string on the server
 * and the client. That determinism is what keeps `renderToString()` and
 * `hydrate()` in agreement — provided the app boots the client with the same
 * initial locale it rendered with on the server.
 */

/** A flat dictionary of message templates for a single locale. */
type MessageMap = Record<string, string>;
/** Values allowed in interpolation params. */
type InterpolationParams = Record<string, string | number>;
interface I18nConfig<M extends MessageMap> {
    /** The initial (and server-rendered) locale. */
    readonly locale: string;
    /** Messages keyed by locale, e.g. `{ en: {...}, fr: {...} }`. */
    readonly messages: Readonly<Record<string, M>>;
    /** Locale consulted when a key is absent from the active locale. */
    readonly fallbackLocale?: string;
}
interface I18n<M extends MessageMap> {
    /** The active locale as a reactive, read-only signal. */
    readonly locale: ReadonlySignal<string>;
    /** Switch the active locale; all `t()`/`plural()` signals recompute. */
    setLocale(locale: string): void;
    /** The locales that have a message map, in declaration order. */
    readonly locales: ReadonlyArray<string>;
    /** Reactive translation. Returns a derived signal — call `.get()` to read. */
    t(key: keyof M & string, params?: InterpolationParams): ReadonlySignal<string>;
    /** Non-reactive translation for the current locale (a one-shot read). */
    translate(key: keyof M & string, params?: InterpolationParams): string;
    /**
     * Reactive pluralization via `Intl.PluralRules`. Selects the message whose
     * key is `${key}.${category}` (e.g. `items.one`), falling back to
     * `${key}.other`. `count` is available to interpolation as `{count}`.
     */
    plural(key: string, count: number, params?: InterpolationParams): ReadonlySignal<string>;
    /** True when the active (or fallback) locale defines `key`. */
    has(key: string): boolean;
}
/** Replace `{name}` placeholders using `params`; unknown names are left intact. */
declare function interpolate(template: string, params?: InterpolationParams): string;
declare function createI18n<M extends MessageMap>(config: I18nConfig<M>): I18n<M>;

/**
 * StreetUI DevTools — graph inspector and debug utilities.
 */

interface InspectedNode {
    id: string;
    type: string;
    key: string | undefined;
    props: Record<string, unknown>;
    eventTypes: string[];
    stateBindings: string[];
    children: InspectedNode[];
    depth: number;
}
declare function inspectGraph(graph: ApplicationGraph): InspectedNode;
/** Print a human-readable tree of the graph to a string. */
declare function printGraph(graph: ApplicationGraph): string;
/** Print compilation diagnostics to a string. */
declare function printDiagnostics(compiled: CompiledApplication): string;
/** Returns node counts per type. */
declare function nodeTypeStats(graph: ApplicationGraph): Record<string, number>;
/** A single component instance surfaced for DevTools inspection (§21). */
interface InspectedComponent {
    /** The build-order node id (churns across rebuilds — not stable identity). */
    id: string;
    /** The stable, author-provided identity key passed at the call site. */
    key: string | undefined;
    /** The definition's human-readable name (from `data-streetui-component`). */
    name: string;
    /** Depth of the component node in the graph. */
    depth: number;
    /** Number of direct child nodes the component rendered. */
    childCount: number;
}
/**
 * List every `component()` instance in the graph, in document order, with its
 * stable `key`, human-readable `name` and location. Components are ordinary
 * `'component'` GraphNodes (they flow through `inspectGraph`/`printGraph`
 * already); this is the first-class, component-aware view for DevTools — it
 * reads the inspectable `data-streetui-component` name attribute the DSL sets,
 * never any internal `_`-prefixed metadata. Names/keys are stable across
 * fine-grained prop updates (which never rebuild the node).
 */
declare function inspectComponents(graph: ApplicationGraph): InspectedComponent[];
/** An overlay currently wired in the graph (dialog/popover/tooltip/…). */
interface InspectedOverlay {
    /** The build-order node id of the overlay's portal host. */
    id: string;
    /** The stable author-provided key, if any. */
    key: string | undefined;
    /** Whether the overlay is open right now (peeked, no subscription). */
    open: boolean;
    /** Modal (focus-trapping) overlay? */
    modal: boolean;
    /** Does it move focus into itself on open? */
    takesFocus: boolean;
    /** Is it a roving-focus menu (role="menu")? */
    menu: boolean;
    /** Does Escape close it? */
    closeOnEscape: boolean;
    /** Does it restore focus to the opener on close? */
    restoreFocus: boolean;
    /** Depth of the portal host node in the graph. */
    depth: number;
}
/** A transition currently wired on a graph node. */
interface InspectedTransition {
    /** The build-order node id the transition is attached to. */
    id: string;
    /** The stable author-provided key, if any. */
    key: string | undefined;
    /** The node type the transition animates (element/portal/list-item/…). */
    nodeType: string;
    /** Fallback completion timeout in ms (the resolved `duration`). */
    duration: number;
    /** Does it animate the very first appearance (initial mount)? */
    appear: boolean;
    /** Depth of the node in the graph. */
    depth: number;
}
/** A prod-safe snapshot of the graph's interaction wiring. */
interface InspectedInteractions {
    overlays: InspectedOverlay[];
    transitions: InspectedTransition[];
}
/**
 * Snapshot every overlay and transition currently wired in the graph, in
 * document order. This is the interaction-aware companion to
 * {@link inspectComponents}: it reads only the `__overlay__<id>` /
 * `__transition__<id>` handler descriptors and public graph structure — it
 * peeks the `open` signal without subscribing, retains no DOM nodes, mutates
 * nothing, and is safe to call in production. Because a departing overlay's
 * handler is pruned on detach (`_unregisterNodeHandlers`), a closed-and-removed
 * overlay simply no longer appears here.
 */
declare function inspectInteractions(graph: ApplicationGraph): InspectedInteractions;

/**
 * DevTools foundation (v0.6, Phase 18). A single read-only entry point that
 * aggregates everything an eventual DevTools UI would need — application
 * identity, the graph tree, signal bindings, page/route surface, node
 * statistics, and diagnostics — WITHOUT introducing a second representation of
 * the graph. It reuses `inspectGraph`/`nodeTypeStats` from the inspector and
 * reads `CompiledApplication` metadata directly. This is a foundation, not a
 * UI: it returns plain data so a UI (or a test, or a CLI command) can render it.
 */

/** Stable identity of a compiled application. */
interface ApplicationIdentity {
    readonly name: string;
    readonly version: string;
    /** Epoch millis the application was compiled. */
    readonly compiledAt: number;
}
/** A page node reachable as a direct child of the application root. */
interface InspectedPage {
    readonly id: string;
    /** The page key when one was supplied in the DSL. */
    readonly key: string | undefined;
}
/** Compilation diagnostics summarised for display. */
interface DiagnosticsSummary {
    readonly errors: number;
    readonly warnings: number;
    readonly messages: string[];
}
/**
 * Cheap, count-only performance snapshot (v0.7 §20). These are structural
 * counts derived from a single graph walk — NOT timings and NOT a profiler.
 * They let a DevTools panel or a CI check spot the shapes that correlate with
 * slow apps (very large graphs, deep trees, big lists, many subscriptions)
 * without measuring anything at runtime.
 */
interface PerfSnapshot {
    /** Total GraphNodes in the tree (root included). */
    readonly totalNodes: number;
    /** Maximum nesting depth (root = 0). */
    readonly maxDepth: number;
    /** Total event handler registrations across all nodes. */
    readonly eventHandlers: number;
    /** Total signal→prop bindings across all nodes. */
    readonly stateBindings: number;
    /** Distinct signals referenced anywhere in the graph. */
    readonly distinctSignals: number;
    /** Largest single-node child count (a proxy for the biggest list/section). */
    readonly largestChildCount: number;
    /**
     * Number of reactive keyed-list sites driven by the optimised lazy-plan
     * reconciler (v1.1 §15/§25). Counted from the graph's `__listplan__<id>`
     * handler registrations — one per `listOf(...)` bound to a signal. These are
     * the nodes whose updates take the identity-short-circuit + LIS minimal-move
     * path, so surfacing the count lets a panel or CI check see how much of an app
     * benefits from the keyed-list engine without measuring anything at runtime.
     */
    readonly reactiveLists: number;
}
/**
 * The complete read-only snapshot of a compiled application. Everything here is
 * derived from the single `CompiledApplication` graph — no state is duplicated.
 */
interface ApplicationInspection {
    readonly identity: ApplicationIdentity;
    readonly graph: InspectedNode;
    /** Count of nodes per DSL type (e.g. `{ section: 2, button: 3 }`). */
    readonly nodeStats: Record<string, number>;
    /** Unique signal ids bound anywhere in the graph, sorted. */
    readonly signals: string[];
    /** Page nodes directly under the root — the app's top-level route surface. */
    readonly pages: InspectedPage[];
    readonly diagnostics: DiagnosticsSummary;
    /** Cheap structural performance counters (v0.7 §20). */
    readonly perf: PerfSnapshot;
}
/**
 * Build the full inspection snapshot for a compiled application. Pure and
 * side-effect free — safe to call in a server, a test, or a DevTools panel.
 */
declare function inspectApplication(compiled: CompiledApplication): ApplicationInspection;

/**
 * Dev-only performance diagnostics (v0.7 §21).
 *
 * A pure, cheap, count-based check that flags graph *shapes* known to correlate
 * with slow apps — very large graphs, deep trees, oversized lists/sections, and
 * heavy reactive fan-out. It is NOT wired into mount/render and adds ZERO cost
 * to the runtime hot path; a developer (or a CLI command, or a test) calls it
 * explicitly. Thresholds are advisory and overridable.
 *
 * This intentionally reuses the counts already produced by `inspectApplication`
 * — it introduces no second graph walk of its own beyond reading that snapshot.
 */

interface PerfThresholds {
    /** Warn when the graph exceeds this many nodes. */
    readonly maxNodes: number;
    /** Warn when nesting depth exceeds this. */
    readonly maxDepth: number;
    /** Warn when any single node has more than this many children (big list). */
    readonly maxChildCount: number;
    /** Warn when distinct signals exceed this (reactive fan-out). */
    readonly maxSignals: number;
}
declare const DEFAULT_PERF_THRESHOLDS: PerfThresholds;
type PerfDiagnosticCode = 'large-graph' | 'deep-tree' | 'large-list' | 'high-signal-fanout';
interface PerfDiagnostic {
    readonly code: PerfDiagnosticCode;
    readonly message: string;
    /** The observed count that tripped the threshold. */
    readonly observed: number;
    /** The threshold it exceeded. */
    readonly threshold: number;
}
/**
 * Return advisory performance diagnostics for a compiled application. An empty
 * array means nothing tripped a threshold. Never throws; never mutates.
 */
declare function diagnosePerformance(compiled: CompiledApplication, thresholds?: Partial<PerfThresholds>): PerfDiagnostic[];

/**
 * Reactive-surface inspection for DevTools.
 *
 * These functions turn the framework's live objects — signals, resources,
 * router, forms, context, i18n — into plain, read-only snapshots suitable for a
 * DevTools panel. They never mutate anything and never subscribe; each call is a
 * one-shot `peek`. Sensitive-by-default surfaces (resource payloads, form field
 * values) are omitted unless the caller explicitly opts in, so a panel cannot
 * accidentally display tokens, passwords, or private data.
 *
 * Router/forms/context/i18n are described by *structural* interfaces rather than
 * imported types, so DevTools stays decoupled from those packages (no extra
 * dependencies) while still inspecting them when present.
 */

interface SignalInspection {
    /** Whether the signal is writable or a derived computation. */
    readonly kind: SignalKind;
    /** The current value (redacted if requested). */
    readonly value: unknown;
    /** Live observer count when the signal exposes it, else undefined. */
    readonly observerCount: number | undefined;
}
interface InspectSignalOptions {
    /**
     * Redact the value: `true` replaces it with `'[redacted]'`; a function maps
     * the raw value to whatever should be shown. Use for signals that may hold
     * sensitive data. Omitted → the value is shown as-is.
     */
    readonly redact?: boolean | ((value: unknown) => unknown);
}
/** Snapshot a signal's kind, current value, and observer count. Read-only. */
declare function inspectSignal(source: ReadonlySignal<unknown>, options?: InspectSignalOptions): SignalInspection;
/** The read-only slice of a resource this module needs. */
interface ResourceLike {
    readonly status: ReadonlySignal<ResourceStatus>;
    readonly data: ReadonlySignal<unknown>;
    readonly error: ReadonlySignal<unknown>;
    readonly loading: ReadonlySignal<boolean>;
    readonly isRefetching: ReadonlySignal<boolean>;
}
interface ResourceInspection {
    readonly status: ResourceStatus;
    readonly loading: boolean;
    readonly isRefetching: boolean;
    readonly hasData: boolean;
    readonly hasError: boolean;
    /** The error's constructor name (safe — no message/payload). */
    readonly errorName: string | undefined;
    /** The error message — only present when `includeData` is set. */
    readonly errorMessage?: string;
    /** The loaded value — only present when `includeData` is set. */
    readonly data?: unknown;
}
interface InspectResourceOptions {
    /**
     * Include the loaded `data` and the error `message`. Off by default because a
     * resource payload commonly carries user or secret data.
     */
    readonly includeData?: boolean;
}
/** Snapshot a resource's lifecycle. Payload/message hidden unless opted in. */
declare function inspectResource(resource: ResourceLike, options?: InspectResourceOptions): ResourceInspection;
/** The read-only slice of a mutation this module needs. */
interface MutationLike {
    readonly status: ReadonlySignal<ResourceStatus>;
    readonly data: ReadonlySignal<unknown>;
    readonly error: ReadonlySignal<unknown>;
    readonly pending: ReadonlySignal<boolean>;
}
interface MutationInspection {
    readonly status: ResourceStatus;
    readonly pending: boolean;
    readonly hasData: boolean;
    readonly hasError: boolean;
    /** The error's constructor name (safe — no message/payload). */
    readonly errorName: string | undefined;
    /** The error message — only present when `includeData` is set. */
    readonly errorMessage?: string;
    /** The most recent result — only present when `includeData` is set. */
    readonly data?: unknown;
}
/**
 * Snapshot a mutation's write-side lifecycle (idle/loading/success/error). The
 * write-side counterpart to {@link inspectResource}: payload/message hidden
 * unless opted in, because a mutation result commonly carries user data. Never
 * triggers the mutation — a pure `peek` over its exposed signals.
 */
declare function inspectMutation(mutation: MutationLike, options?: InspectResourceOptions): MutationInspection;
interface RouteMatchLike {
    readonly path: string;
    readonly pattern: string;
    readonly params: Readonly<Record<string, string>>;
    readonly query: URLSearchParams;
    readonly isFallback?: boolean;
}
interface RouterLike {
    readonly currentRoute: ReadonlySignal<RouteMatchLike>;
}
interface RouterInspection {
    readonly path: string;
    readonly pattern: string;
    readonly params: Record<string, string>;
    readonly query: Record<string, string>;
    readonly isFallback: boolean;
}
/** Snapshot the router's current route. Read-only. */
declare function inspectRouter(router: RouterLike): RouterInspection;
interface FormLike {
    readonly values: ReadonlySignal<Record<string, unknown>>;
    readonly errors: ReadonlySignal<Record<string, string | undefined>>;
    readonly touched: ReadonlySignal<Record<string, boolean | undefined>>;
    readonly dirty: ReadonlySignal<boolean>;
    readonly valid: ReadonlySignal<boolean>;
    readonly status: ReadonlySignal<string>;
}
interface FormInspection {
    readonly fields: string[];
    /** Per-field validation messages (safe — not the entered values). */
    readonly errors: Record<string, string>;
    readonly touched: Record<string, boolean>;
    readonly dirty: boolean;
    readonly valid: boolean;
    readonly status: string;
    /** Entered field values — only present when `includeValues` is set. */
    readonly values?: Record<string, unknown>;
}
interface InspectFormOptions {
    /**
     * Include the entered field `values`. Off by default because form fields
     * frequently hold passwords or other secrets.
     */
    readonly includeValues?: boolean;
}
/** Snapshot form validation state. Entered values hidden unless opted in. */
declare function inspectForm(form: FormLike, options?: InspectFormOptions): FormInspection;
interface ContextLike {
    readonly id: symbol;
    hasProvider(): boolean;
}
interface ContextInspection {
    /** The context's descriptive label (from its Symbol). */
    readonly description: string;
    /** Whether a provider is currently active. */
    readonly hasProvider: boolean;
}
/** Snapshot a context's identity and provider presence. No value dumped. */
declare function inspectContext(context: ContextLike): ContextInspection;
interface I18nLike {
    readonly locale: ReadonlySignal<string>;
    readonly locales: ReadonlyArray<string>;
    has(key: string): boolean;
}
interface I18nInspection {
    readonly locale: string;
    readonly locales: string[];
    /** Of the probed keys, those with no translation in the active/fallback locale. */
    readonly missingKeys?: string[];
}
interface InspectI18nOptions {
    /** Keys to probe for presence; any absent ones are reported as missing. */
    readonly checkKeys?: readonly string[];
}
/** Snapshot i18n locale state and (optionally) missing translation keys. */
declare function inspectI18n(i18n: I18nLike, options?: InspectI18nOptions): I18nInspection;

/**
 * Detailed structural inspectors for DevTools (2.2 Phase 1).
 *
 * Two read-only views derived purely from the one compiled graph — no second
 * graph, no subscriptions, no runtime instrumentation:
 *
 *   - `inspectEvents`  — the Event Inspector panel (#8): every node that carries
 *     event handlers, with the handler *types* it registers (never the handler
 *     functions themselves).
 *   - `inspectSignalGraph` — the Signal / Dependency Graph panel (#4): the
 *     bipartite wiring between distinct signal ids and the graph nodes that bind
 *     them, optionally enriched with each signal's live `kind` and
 *     `observerCount` when the caller supplies the live `Signal` instances by id.
 *
 * Both are pure: safe to call in a server, a test, or a DevTools panel.
 */

/** A node that registers one or more event handlers. */
interface InspectedEventNode {
    /** The build-order node id. */
    readonly id: string;
    /** The node's semantic type (button/input/…). */
    readonly nodeType: string;
    /** The stable author-provided key, if any. */
    readonly key: string | undefined;
    /** Depth of the node in the graph. */
    readonly depth: number;
    /** Event types wired on the node (e.g. `['click', 'keydown']`). Sorted. */
    readonly eventTypes: readonly string[];
}
/** A prod-safe summary of the graph's event wiring. */
interface EventInspection {
    /** Every node carrying handlers, in document order. */
    readonly nodes: readonly InspectedEventNode[];
    /** Total handler registrations across all nodes. */
    readonly totalHandlers: number;
    /** Count of registrations per event type (e.g. `{ click: 3, input: 2 }`). */
    readonly byType: Readonly<Record<string, number>>;
}
/**
 * List every node that registers event handlers, with the handler *types* it
 * wires. Reads only the public graph structure (`node.events[].type`); the
 * handler functions are never surfaced. Document order, deterministic.
 */
declare function inspectEvents(graph: ApplicationGraph): EventInspection;
/** One signal id and the nodes that bind it. */
interface SignalGraphNode {
    /** The signal id as recorded in the graph's state references. */
    readonly signalId: string;
    /** Distinct graph-node ids that bind this signal. */
    readonly boundNodeIds: readonly string[];
    /** Number of binding edges into this signal (may exceed boundNodeIds if a node binds it twice). */
    readonly bindingCount: number;
    /** Live signal kind, present only when the live instance was supplied. */
    readonly kind?: SignalKind;
    /** Live observer count, present only when the live instance was supplied. */
    readonly observerCount?: number;
}
/** A single binding edge: a node prop is driven by a signal. */
interface SignalGraphEdge {
    readonly signalId: string;
    readonly nodeId: string;
    readonly nodeType: string;
    readonly propKey: string;
}
/** The bipartite signal↔node wiring of an application. */
interface SignalGraph {
    /** Distinct signals bound anywhere in the graph, sorted by id. */
    readonly signals: readonly SignalGraphNode[];
    /** Every binding edge, in document order. */
    readonly edges: readonly SignalGraphEdge[];
}
interface InspectSignalGraphOptions {
    /**
     * Live `Signal` instances keyed by their signal id. When supplied, each
     * matching signal in the graph is enriched with its live `kind` and
     * `observerCount`. Purely additive — omit for a structure-only graph.
     */
    readonly signalsById?: Readonly<Record<string, ReadonlySignal<unknown>>>;
}
/**
 * Build the bipartite dependency graph between signals and the nodes that bind
 * them. Structural by default; pass `signalsById` to enrich with live
 * kind/observer counts. Deterministic ordering (edges in document order,
 * signals sorted by id).
 */
declare function inspectSignalGraph(compiled: CompiledApplication, options?: InspectSignalGraphOptions): SignalGraph;

/**
 * SSR / Hydration inspection for DevTools (2.2 Phase 1, panel #12).
 *
 * A structural, read-only view of how a compiled application splits into the
 * parts that are *statically serialized* on the server versus the *dynamic*
 * parts the client must hydrate. It reuses the compiler's existing
 * `analyzeGraph` classifier (the very same analysis the SSR static-subtree plan
 * and the hydration fast-path already consume) so DevTools introduces no second
 * analysis and no second graph. Nothing is measured at runtime and nothing is
 * mutated — this is a pure derivation over the one `CompiledApplication`.
 *
 * HONEST SCOPE: these are *structural* counts (how many nodes are static, how
 * many hydrate, how many portals/islands exist). They are NOT wall-clock SSR or
 * hydration timings — real render/hydrate timing needs a browser, and the
 * browser gate is BLOCKED in this environment. The panel labels this honestly.
 */

interface HydrationInspection {
    /** Total GraphNodes analysed (root included). */
    readonly totalNodes: number;
    /** Nodes classified static (no dynamic text/attr/events of their own). */
    readonly staticNodes: number;
    /** Maximal whole-static subtrees — the units the SSR plan precomputes verbatim. */
    readonly staticSubtrees: number;
    /** Dynamic nodes the client must reconcile/hydrate (total − static). */
    readonly dynamicNodes: number;
    /** Nodes with dynamic (signal-bound) text. */
    readonly dynamicTextNodes: number;
    /** Nodes with dynamic (signal-bound) attributes. */
    readonly dynamicAttrNodes: number;
    /** Nodes carrying event handlers — the interactive surface hydration wires. */
    readonly eventNodes: number;
    /** Reactive keyed-list sites. */
    readonly lists: number;
    /** Conditional (`when`) sites. */
    readonly conditionals: number;
    /** Portal hosts (overlays) — relocated to <body> on hydrate, inlined in SSR. */
    readonly portals: number;
    /** `head()` contribution anchors — adopted, never duplicated, on hydrate. */
    readonly headAnchors: number;
    /**
     * Fraction of nodes that are static (0..1), rounded to 4 dp. A high ratio
     * means most of the document ships as precomputed HTML and hydration only
     * wires the dynamic remainder. Deterministic; no timing involved.
     */
    readonly staticRatio: number;
}
/**
 * Build the SSR/hydration inspection for a compiled application. Pure and
 * side-effect free — safe in a server, a test, or a DevTools panel.
 */
declare function inspectHydration(compiled: CompiledApplication): HydrationInspection;

/**
 * DevTools session & panels — the first real StreetUI DevTools surface.
 *
 * This is a *headless* DevTools layer: it composes the existing read-only
 * inspection functions (`inspectApplication`, `diagnosePerformance`, and the
 * reactive inspectors) into the panels a DevTools UI shows — Application, Graph,
 * Signals, Router, Resources, Forms, Context, i18n, and Performance — and
 * returns them as plain data plus a text formatter. Any host (a browser panel, a
 * CLI command, a test) can render that data.
 *
 * Design constraints honoured here:
 *   - No second graph and no second reactive system — everything is derived from
 *     the one `CompiledApplication` and the app's own live signals.
 *   - Explicit activation: nothing in the runtime imports this. A session only
 *     exists once dev code calls `createDevTools`, so production pays no cost.
 *   - Live updates use a simple explicit `refresh()` — DevTools never subscribes
 *     to or instruments the reactive graph.
 *   - Sensitive surfaces (resource payloads, form values) stay hidden unless the
 *     caller opts in per the underlying inspectors.
 */

interface ApplicationPanel {
    readonly identity: ApplicationIdentity;
    readonly nodeCount: number;
    readonly maxDepth: number;
    readonly pages: readonly InspectedPage[];
    readonly signalCount: number;
    readonly eventHandlers: number;
    readonly stateBindings: number;
    readonly errors: number;
    readonly warnings: number;
}
interface SignalsPanel {
    /** Distinct signal ids referenced anywhere in the graph (structural). */
    readonly boundSignalIds: readonly string[];
    /** Live inspections for signals the app registered with DevTools, by label. */
    readonly live: Readonly<Record<string, SignalInspection>>;
}
interface PerformancePanel {
    readonly snapshot: ApplicationInspection['perf'];
    readonly diagnostics: readonly PerfDiagnostic[];
}
/**
 * Compilation diagnostics for the DevTools "Diagnostics" panel (§8). These are
 * the compiler's own findings (errors + warnings), surfaced verbatim — not a
 * runtime error stream. Runtime/production error reports flow through the
 * separate `reportError`/`DiagnosticSink` seam in `streetui` (§7).
 */
interface DiagnosticsPanel {
    readonly errors: number;
    readonly warnings: number;
    readonly messages: readonly string[];
}
/** All panels captured at one `refresh()`. */
interface DevToolsSnapshot {
    readonly application: ApplicationPanel;
    readonly graph: InspectedNode;
    readonly signals: SignalsPanel;
    readonly performance: PerformancePanel;
    /**
     * Component tree (§9): every `component()` instance in document order, with
     * its stable key/name/location. Read structurally from the graph — the same
     * data an app/component-tree UI panel renders.
     */
    readonly components: readonly InspectedComponent[];
    /** Overlays currently wired (§13), in graph/containment order (dialog/popover/…). */
    readonly overlays: readonly InspectedOverlay[];
    /** Transitions currently wired on nodes (§14). Structural — never interferes with lifecycle. */
    readonly transitions: readonly InspectedTransition[];
    /** Compilation diagnostics (§8). */
    readonly diagnostics: DiagnosticsPanel;
    /**
     * Event Inspector (panel #8): every node carrying handlers, with the event
     * *types* wired (never the handler functions). Structural, deterministic.
     */
    readonly events: EventInspection;
    /**
     * Signal / Dependency Graph (panel #4): the bipartite signal↔node wiring,
     * enriched with live kind/observer counts for any signal the app registered
     * (matched by id against `sources.signalsById`).
     */
    readonly signalGraph: SignalGraph;
    /**
     * SSR / Hydration Inspector (panel #12): structural static-vs-dynamic split.
     * Counts only — NOT wall-clock SSR/hydration timings (browser gate BLOCKED).
     */
    readonly hydration: HydrationInspection;
    readonly router?: RouterInspection;
    readonly resources?: Readonly<Record<string, ResourceInspection>>;
    /** Mutation Inspector (panel #7): live write-side lifecycles, by label. */
    readonly mutations?: Readonly<Record<string, MutationInspection>>;
    readonly forms?: Readonly<Record<string, FormInspection>>;
    readonly contexts?: Readonly<Record<string, ContextInspection>>;
    readonly i18n?: I18nInspection;
}
/**
 * The app's own live reactive objects, handed to DevTools explicitly so it can
 * inspect them. The compiled graph knows signal *ids* but not the live `Signal`
 * instances, so the app registers whichever surfaces it wants visible. Every
 * field is optional — a session works with none of them (structure-only).
 */
interface DevToolsSources {
    /** Live signals to inspect, keyed by a human label shown in the panel. */
    readonly signals?: Readonly<Record<string, ReadonlySignal<unknown>>>;
    /**
     * Live signals keyed by their *signal id* (not a human label). Used only to
     * enrich the Signal/Dependency Graph (panel #4) with live kind/observer
     * counts. Optional and purely additive — omit for a structure-only graph.
     */
    readonly signalsById?: Readonly<Record<string, ReadonlySignal<unknown>>>;
    /** Live resources to inspect, keyed by label. */
    readonly resources?: Readonly<Record<string, ResourceLike>>;
    /** Live mutations to inspect, keyed by label (panel #7). */
    readonly mutations?: Readonly<Record<string, MutationLike>>;
    /** The app router, if any. */
    readonly router?: RouterLike;
    /** Live forms to inspect, keyed by label. */
    readonly forms?: Readonly<Record<string, FormLike>>;
    /** Live contexts to inspect, keyed by label. */
    readonly contexts?: Readonly<Record<string, ContextLike>>;
    /** The app i18n instance, if any. */
    readonly i18n?: I18nLike;
}
interface DevToolsOptions {
    /** Thresholds forwarded to `diagnosePerformance`. */
    readonly perfThresholds?: PerfThresholds;
    /**
     * Redact live signal values by default (passed to `inspectSignal`). Use in
     * shared or recorded sessions so values never reach the panel. Off by default.
     */
    readonly redactSignals?: boolean | ((value: unknown) => unknown);
    /** i18n keys to probe for missing translations, forwarded to `inspectI18n`. */
    readonly i18nCheckKeys?: readonly string[];
}
/**
 * A headless DevTools session over one compiled application.
 *
 * The session holds the compiled app plus the app's registered live sources and
 * produces an immutable {@link DevToolsSnapshot} on demand. Live values are read
 * only when `refresh()` is called (explicit-refresh protocol, §7): the session
 * never subscribes to signals or instruments the reactive graph, so it adds no
 * cost to the running app between refreshes.
 */
interface DevToolsSession {
    /** The most recent snapshot. Recomputed by `refresh()`. */
    readonly snapshot: DevToolsSnapshot;
    /**
     * Recompute every panel from the current live state and return the new
     * snapshot. This is the only way values change — DevTools pulls, it never
     * gets pushed to.
     */
    refresh(): DevToolsSnapshot;
    /**
     * Find a node in the graph by id and return that subtree, or `undefined`.
     * Backs a UI tree inspector's node-selection (§8) without a second graph.
     */
    selectNode(id: string): InspectedNode | undefined;
    /** Render the current snapshot as a plain-text report (for CLI/tests/logs). */
    format(): string;
}
/**
 * Create a DevTools session. Nothing in the runtime calls this — a session only
 * exists once dev code opts in, so production never pays for it.
 */
declare function createDevTools(compiled: CompiledApplication, sources?: DevToolsSources, options?: DevToolsOptions): DevToolsSession;

/**
 * DevTools view (2.0 §8) — a DOM-free HTML renderer for a {@link DevToolsSnapshot}.
 *
 * This is the "initial UI" layer: it turns the headless snapshot (already
 * composed from the existing read-only inspectors) into a single self-contained
 * HTML string a host can inject into a panel, an iframe, or a static report. It
 * is deliberately a *pure string builder*:
 *
 *   - No DOM API is touched and nothing is mounted, so it runs anywhere (Node,
 *     a worker, a test) and adds nothing to the running app.
 *   - It reads ONLY the snapshot — no second graph, no reactive subscriptions,
 *     no retained resource/DOM references.
 *   - Every dynamic value is HTML-escaped, so an app's data (signal values that
 *     the caller chose to expose, route paths, form labels) can never break out
 *     of the markup.
 *
 * HONEST SCOPE: this produces markup. Whether it *renders* correctly in a real
 * browser, is accessible to a screen reader, or performs at 60fps is NOT claimed
 * here and has NOT been verified — no browser/AT is available in this
 * environment (the §24 browser gate remains BLOCKED). The value proven by tests
 * is that the string faithfully and safely reflects the snapshot.
 *
 * EFFECTS (§8): StreetUI keeps no global registry of effects (that would require
 * instrumenting the reactive runtime, which DevTools deliberately does not do).
 * The closest safe signal is each live signal's `observerCount` — the number of
 * effects/derivations currently depending on it — which the Signals section
 * shows. The view labels this honestly rather than inventing an effect list.
 */

/** Escape a string for safe interpolation into HTML text/attribute content. */
declare function escapeHtml(value: unknown): string;
/**
 * Render a snapshot to a complete, self-contained HTML document string. The
 * markup is static; call `renderDevToolsHTML(session.refresh())` again to
 * reflect new state (DevTools pulls — it is never pushed to).
 */
declare function renderDevToolsHTML(s: DevToolsSnapshot): string;

/**
 * Interactive DevTools view (2.2 Phase 1) — a self-contained, 12-panel browser
 * DevTools surface rendered as ONE HTML document.
 *
 * This extends the static `renderDevToolsHTML` (2.0 §8) into a *tabbed,
 * interactive* tool while preserving every DevTools design constraint:
 *
 *   - It consumes ONLY an existing {@link DevToolsSnapshot} (already composed
 *     from the read-only inspectors). There is NO second framework runtime, NO
 *     second reactive system, NO second graph, and NO DOM/subscription work at
 *     render time — this function is a pure string builder.
 *   - The snapshot is embedded once as inert JSON. A small, dependency-free
 *     vanilla-JS controller (no framework, no bundler, no network) renders the
 *     panels from that JSON in the browser: tab switching, component selection,
 *     and a Refresh button.
 *   - Refresh is pull-based and never mutates the app: the controller calls an
 *     optional host hook `window.__STREETUI_DEVTOOLS_REFRESH__()` that, when the
 *     host provides it, returns a fresh snapshot (e.g. from `session.refresh()`).
 *     Absent the hook, Refresh is a no-op — DevTools is never pushed to.
 *   - Every value the controller injects into the DOM is escaped; the embedded
 *     JSON is `<`-escaped so app data cannot break out of the <script> block.
 *
 * The 12 panels map 1:1 to the milestone spec: (1) Component Tree,
 * (2) Component Inspector, (3) Reactive State, (4) Signal/Dependency Graph,
 * (5) Router, (6) Resource/Async, (7) Mutation, (8) Event, (9) Overlay,
 * (10) Performance Timeline, (11) Error Diagnostics, (12) SSR/Hydration.
 *
 * HONEST SCOPE: this produces markup + a controller script. That it *renders*
 * pixels, is screen-reader conformant, or hits 60fps in a real browser is NOT
 * claimed and has NOT been observed here — no browser/AT exists in this
 * environment (browser + AT gates remain BLOCKED). What tests verify is that the
 * document faithfully and safely embeds the snapshot and that the controller
 * logic is deterministic (exercised under happy-dom, which is NOT a browser).
 */

interface InteractiveDevToolsOptions {
    /** Tab id to open first. Defaults to `'components'`. */
    readonly initialTab?: string;
    /** Document <title>. Defaults to `StreetUI DevTools — <app name>`. */
    readonly title?: string;
}
/** The 12 panels, in tab order. `id` is stable and used by the controller/tests. */
declare const DEVTOOLS_TABS: readonly {
    readonly id: string;
    readonly label: string;
}[];
/**
 * Render the interactive 12-panel DevTools document for a snapshot. Static,
 * side-effect-free string builder. Re-run with a fresh snapshot (or let the
 * in-page Refresh button pull one via the host hook) to reflect new state.
 */
declare function renderInteractiveDevTools(snapshot: DevToolsSnapshot, options?: InteractiveDevToolsOptions): string;

/**
 * DevTools report (2.1 §23) — the first *usable* DevTools interface: one call
 * that turns a compiled application into a complete, self-contained HTML page a
 * developer can open in a browser (or save as a static report / inject into a
 * panel or iframe).
 *
 * It is a thin, additive convenience over the pieces that already shipped in
 * 2.0 — it composes them, it adds no new capability:
 *
 *     renderDevToolsReport(compiled)  ≡  renderDevToolsHTML(createDevTools(compiled).snapshot)
 *
 * Properties inherited from those pieces (nothing new is introduced):
 *   - DOM-free: pure string building; touches no DOM API and mounts nothing, so
 *     it runs in Node, a worker, or a test.
 *   - Non-mutating & non-instrumenting: reads only the compiled app plus any
 *     live sources the caller passes; never subscribes to signals, never patches
 *     the reactive runtime. DevTools pulls — it is never pushed to.
 *   - Zero production cost: nothing in the runtime imports this; the interface
 *     exists only once dev code opts in by calling it.
 *
 * HONEST SCOPE (unchanged from the view layer): this produces markup. Whether it
 * renders pixel-correctly, is screen-reader accessible, or hits 60fps in a real
 * browser is NOT claimed and has NOT been verified here — the browser/AT gates
 * are BLOCKED (no Chromium/AT in this environment). What is verified is that the
 * emitted document faithfully and safely (HTML-escaped) reflects the snapshot.
 */

/**
 * Build a complete, self-contained DevTools HTML document for a compiled app in
 * one call. Equivalent to rendering `createDevTools(compiled, sources, options)`'s
 * current snapshot; call again to reflect new state (DevTools pulls).
 */
declare function renderDevToolsReport(compiled: CompiledApplication, sources?: DevToolsSources, options?: DevToolsOptions): string;

/**
 * StreetUI project configuration (Phase 9). The config is intentionally tiny:
 * every field has a sensible default so `streetui.config.ts` is optional. A
 * project with no config file still builds and runs.
 *
 * The file is authored as TypeScript (`streetui.config.ts`) and compiled with
 * esbuild to a temporary ESM module before import, so we never depend on the
 * host having a TS loader registered.
 */
/** User-facing configuration shape (all fields optional). */
interface StreetUIConfig {
    /** Dev server / preview port. Default 3000. */
    readonly port?: number;
    /** Host to bind. Default 'localhost'. */
    readonly host?: string;
    /** Client/browser entry, relative to project root. Default 'src/main.ts'. */
    readonly clientEntry?: string;
    /** Server entry used for SSR, relative to project root. Default 'src/server.ts'. */
    readonly serverEntry?: string;
    /** Output directory for `build`. Default 'dist'. */
    readonly outDir?: string;
    /** Static assets directory copied verbatim. Default 'public'. */
    readonly publicDir?: string;
}
/** Fully-resolved config: every field present, all paths absolute. */
interface ResolvedConfig {
    readonly root: string;
    readonly port: number;
    readonly host: string;
    readonly clientEntry: string;
    readonly serverEntry: string;
    readonly outDir: string;
    readonly publicDir: string;
}

/**
 * Project-configuration surface for `streetui.config.ts`.
 *
 * The configuration *type* is single-sourced from the internal CLI module (so
 * there is exactly one authoritative `StreetUIConfig` shape). `defineConfig` is
 * the standard one-line identity helper used purely for editor type-inference on
 * the exported config object.
 *
 * This lives in its own tiny module — rather than re-exporting `defineConfig`
 * from the CLI barrel — so that importing `streetui` for application code does
 * **not** drag the CLI's build machinery (and its `esbuild` dependency) into the
 * client runtime bundle. The CLI's own `loadConfig` reads the default export of
 * `streetui.config.ts` regardless of which identity helper wrapped it, so the
 * behaviour is identical to configuring via the CLI directly.
 */

/** Identity helper that gives `streetui.config.ts` full type-checking + inference. */
declare function defineConfig(config: StreetUIConfig): StreetUIConfig;

export { type A11yIds, type AnimateOptions, type AnimationName, type Announcer, Application, ApplicationGraph, ApplicationId, type ApplicationIdentity, type ApplicationInspection, type ApplicationOptions, type ApplicationPanel, type AuthSession, type AuthSessionConfig, type AuthStatus, BREAKPOINTS, type BodyOptions, type Breakpoint, BrowserDOMAdapter, type CSSValue, type CanonicalStyle, type CenterOptions, CleanupRegistry, type Client, type ClientConfig, CompiledApplication, type ComponentState, ContainerDSL, type ContainerStyleOptions, type Context, type ContextInspection, type ContextLike, DEFAULT_PERF_THRESHOLDS, DEFAULT_TOKENS, DEVTOOLS_TABS, DOMAdapter, type DeepPartial, type DevToolsOptions, type DevToolsSession, type DevToolsSnapshot, type DevToolsSources, DiagnosticCollector, type DiagnosticContext, type DiagnosticSink, type DiagnosticsPanel, type DiagnosticsSummary, type DomBinding, DomEventRegistry, type DurationKey, type EasingKey, Environment, type EnvironmentCapabilities, type EnvironmentKind, type ErrorReport, type ErrorReportOptions, EventBus, type EventHandler, type EventInspection, FOCUSABLE_SELECTOR, type FetchLike, type Field, type FocusRingOptions, type Form, type FormConfig, type FormInspection, type FormLike, type FormValidators, type FormValues, type GeneratedCSS, GraphNode, type GridOptions, type HeadingLevel, type HeadingStyleOptions, HttpError, type HttpMethod, HydrationDiagnosticSink, type HydrationInspection, type I18n, type I18nConfig, type I18nInspection, type I18nLike, type InspectFormOptions, type InspectI18nOptions, type InspectResourceOptions, type InspectSignalGraphOptions, type InspectSignalOptions, type InspectedComponent, type InspectedEventNode, type InspectedInteractions, type InspectedNode, type InspectedOverlay, type InspectedPage, type InspectedTransition, type InteractiveDevToolsOptions, type InterpolationParams, type IsActiveOptions, type Job, Lifecycle, type LoadUser, type MatchResult, type MessageMap, type MountFn, type MountRouterOptions, type MountedApplication, type MountedRouter, type Mutation, type MutationInspection, type MutationLike, type MutationOptions, type MutationStatus, type Mutator, type NavigateOptions, NodeInstance, type NodeInstanceOptions, PageDSL, type PerfDiagnostic, type PerfDiagnosticCode, type PerfSnapshot, type PerfThresholds, type PerformancePanel, type PlanEntry, type Priority, type PseudoState, ROUTER_OUTLET_ID, ROUTER_OUTLET_KEY, type ReactiveStyle, ReadonlySignal, type ReconcileResult, RenderContext, RenderHandle, type RenderStylesOptions, type RequestConfig, type ResolvedConfig, type ResolvedTheme, type ResolvedTransitionLike, Resource, type ResourceInspection, type ResourceLike, ResourceLoaderContext, ResourceOptions, ResourceStatus, type ResponsiveValue, type RouteBuilder, type RouteContext, type RouteDefinition, type RouteMatch, type RouteMatchLike, type Router, type RouterHistory, type RouterInspection, type RouterLike, type RouterLocation, type RouterOptions, type RowOptions, Runtime, RuntimeNodeInstance, type RuntimeOptions, Scheduler, type SchedulerDiagnostics, SemanticNodeType, ServerComment, ServerElement, ServerFragment, type ServerNode, type ServerNodeKind, type ServerParent, ServerRawHTML, ServerStyle, ServerText, type ShellBuilder, Signal, type SignalGraph, type SignalGraphEdge, type SignalGraphNode, type SignalInspection, SignalKind, type SignalsPanel, type SpaceKey, type SpacerOptions, type StackOptions, Store, type StoreState, type StreetEvent, type StreetEventType, StreetFrameworkError, StreetRenderHandle, StreetRenderer, StreetRendererImpl, type StreetRendererOptions, type StreetUIConfig, type StyleBand, type StyleDef, type StyleProperties, StyleRegistry, type SubmitStatus, Subscriber, type ThemeChoice, type ThemeController, type ThemeOptions, type ThemeStorage, type ThemeTokenDef, type ThemeTokens, type TokenLeaf, type TokenRefs, type TokenTree, TransitionConfig, TransitionController, type TransitionHooks, type TransitionOptions, type TransitionPhase, type TransitionPresetOptions, Unsubscribe, type Validator, type VariantConfig, type VariantFn, type VariantGroups, type VariantSelection, a11y, a11yIds, adoptServerStyles, animate, animation, applyNodeProps, applyProp, backdrop, bindDomEvent, blockquote, body, browserDOMAdapter, button, buttonUpdate, canonicalize, caption, center, code, consoleDiagnosticSink, containFocus, container, createAnnouncer, createApplication, createAuthSession, createBrowserHistory, createClient, createContext, createDevTools, createForm, createI18n, createMemoryHistory, createRenderer, createRouter, createRuntime, createStore, createStreetEvent, createTheme, createThemeTokens, cssPropName, cssValue, cx, defaultThemeStorage, defineConfig, describeError, diagnosePerformance, dialog, dropdown, dropdownItem, email, environment, escapeHtml, escapeHtmlAttr, escapeHtmlText, fadeTransition, field, fieldError, fieldHelp, fieldLabel, flushSync, focusById, focusFirst, focusInitial, focusRing, form, formatDiagnosticContext, frameworkError, generateCSS, getFocusable, getResolvedTransition, globalEventBus, grid, hashIdentity, heading, headingUpdate, hydrateGraph, identityOf, input, inputUpdate, inspectApplication, inspectComponents, inspectContext, inspectEvents, inspectForm, inspectGraph, inspectHydration, inspectI18n, inspectInteractions, inspectMutation, inspectResource, inspectRouter, inspectSignal, inspectSignalGraph, interpolate, label, layout, link, linkUpdate, list, matchPattern, matchRoutes, maxLength, minLength, mountGraph, mountNode, mountRouter, mutation, nodeTypeStats, normalizePath, onEscape, overlay, patchNode, patchProp, pattern, popover, pre, printDiagnostics, printGraph, reactiveVarName, reactiveVarValue, reconcileChildren, reconcileChildrenByPlan, renderDevToolsHTML, renderDevToolsReport, renderInteractiveDevTools, renderStyles, reportDiagnostic, reportError, required, resolveTag, restoreFocus, routerOutlet, rovingMenu, row, runElementTransition, runValidators, saveFocus, scaleTransition, scheduleImmediate, scheduleUpdate, scheduler, serializeChildren, serializeServerNode, skipLink, slideTransition, spacer, splitTarget, stack, stateAttr, style, styleRegistry, styleVariants, styleWithVars, text, textUpdate, toIdToken, toast, tokens, tooltip, transformGraph, transition, transitions, trapFocus, validateGraph, visuallyHidden, wireComponentBehavior, wireEvents, wireOverlayBehavior, wireReactiveList, wireSignalBindings };
