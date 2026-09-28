import { c as Signal, d as Subscriber, U as Unsubscribe, R as ReadonlySignal, e as ResourceStatus, f as ResourceOptions, g as Resource, h as ResourceLoaderContext, A as ApplicationId, D as DiagnosticCollector, i as ApplicationGraph, G as GraphNode, C as CompiledApplication, j as HydrationDiagnosticSink, k as SemanticNodeType, P as PageDSL, T as TransitionConfig, l as ContainerDSL, m as SignalKind } from './hydration-diagnostics-CFYDXBlm.cjs';
export { n as A11yOptions, o as AppBuilder, p as AppDSL, q as AppOptions, r as ApplicationGraphOptions, s as AsyncBoundaryBranches, B as BaseNode, t as Bindable, u as BindableString, v as BindableText, w as BoundInputOptions, x as ButtonOptions, y as CompileOptions, b as ComponentChildren, z as ComponentContext, a as ComponentDefinition, E as ComponentRender, F as ComponentSetup, b as ContainerBuilder, I as ContainerBuilderImpl, J as ContainerOptions, K as ContentDSL, L as ControlledInputOptions, M as DerivedSignal, N as Diagnostic, O as DiagnosticError, Q as DiagnosticLocation, W as DiagnosticSeverity, X as ErrorBoundaryOptions, Y as ErrorFallbackBuilder, Z as ErrorSource, _ as EventDescriptor, $ as FormBuilder, a0 as FormBuilderImpl, a1 as FormDSL, a2 as FormOptions, a3 as GraphNodeData, a4 as HandlerFn, a5 as HeadContribution, a6 as HeadEntry, a7 as HeadMetadata, a8 as HeadingOptions, H as HydrationDiagnostic, a9 as HydrationMismatchType, aa as ImageOptions, ab as InputOptions, ac as InputOptionsBase, ad as LinkDescriptor, ae as LinkOptions, af as ListBuilder, ag as ListBuilderImpl, ah as ListDSL, ai as ListOptions, aj as ListPlanEntry, ak as MetaDescriptor, al as NodeId, am as NodeMetadata, an as OverlayOptions, ao as PageBuilder, ap as PageBuilderImpl, aq as PortalOptions, ar as PropValue, as as Props, at as ReactiveConsumer, au as ReactiveSource, av as ResolvedTransition, aw as ResourceLoader, ax as SectionBuilder, ay as SectionBuilderImpl, az as SectionDSL, aA as SectionOptions, aB as SerializedGraph, aC as SerializedNode, aD as StateRef, S as StreetApp, aE as StreetUI, aF as TextOptions, aG as TextValue, V as VERSION, aH as WhenOptions, aI as batch, aJ as compile, aK as compileGraph, aL as component, aM as consoleHydrationDiagnosticSink, aN as createHydrationDiagnosticCollector, aO as createNodeId, aP as derived, aQ as effect, aR as formatDiagnostic, aS as formatHydrationDiagnostic, aT as generateApplicationId, aU as generateNodeId, aV as isBatching, aW as isComponentDefinition, aX as isHeadContribution, aY as isTransitionConfig, aZ as nextId, a_ as nodeIdPrefix, a$ as observerCount, b0 as reactiveListItemKey, b1 as reactiveListItemSignature, b2 as resetIdCounter, b3 as resolveHead, b4 as resolveTransition, b5 as resource, b6 as signal, b7 as signalKind, b8 as streetui } from './hydration-diagnostics-CFYDXBlm.cjs';
import { L as Lifecycle, C as CleanupRegistry, D as DOMAdapter, N as NodeInstance, R as RenderContext } from './server-DnAOFpMP.cjs';
export { H as HeadManager, a as LifecycleHook, b as LifecyclePhase, c as RenderToStringOptions, S as STATE_MARKER_ATTR, d as ServerDOMAdapter, e as createRenderContext, r as readState, f as renderHead, g as renderToString, s as serializeState, h as serverDOMAdapter, w as wireHeadBehavior } from './server-DnAOFpMP.cjs';
import { R as RenderHandle, S as StreetRenderer } from './renderer-interface-BUhHV7ja.cjs';

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
    readonly router?: RouterInspection;
    readonly resources?: Readonly<Record<string, ResourceInspection>>;
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
    /** Live resources to inspect, keyed by label. */
    readonly resources?: Readonly<Record<string, ResourceLike>>;
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

export { type A11yIds, type Announcer, Application, ApplicationGraph, ApplicationId, type ApplicationIdentity, type ApplicationInspection, type ApplicationOptions, type ApplicationPanel, type AuthSession, type AuthSessionConfig, type AuthStatus, BrowserDOMAdapter, CleanupRegistry, type Client, type ClientConfig, CompiledApplication, ContainerDSL, type Context, type ContextInspection, type ContextLike, DEFAULT_PERF_THRESHOLDS, DOMAdapter, type DevToolsOptions, type DevToolsSession, type DevToolsSnapshot, type DevToolsSources, DiagnosticCollector, type DiagnosticContext, type DiagnosticSink, type DiagnosticsPanel, type DiagnosticsSummary, type DomBinding, DomEventRegistry, Environment, type EnvironmentCapabilities, type EnvironmentKind, type ErrorReport, type ErrorReportOptions, EventBus, type EventHandler, FOCUSABLE_SELECTOR, type FetchLike, type Field, type Form, type FormConfig, type FormInspection, type FormLike, type FormValidators, type FormValues, GraphNode, HttpError, type HttpMethod, HydrationDiagnosticSink, type I18n, type I18nConfig, type I18nInspection, type I18nLike, type InspectFormOptions, type InspectI18nOptions, type InspectResourceOptions, type InspectSignalOptions, type InspectedComponent, type InspectedInteractions, type InspectedNode, type InspectedOverlay, type InspectedPage, type InspectedTransition, type InterpolationParams, type IsActiveOptions, type Job, Lifecycle, type LoadUser, type MatchResult, type MessageMap, type MountFn, type MountRouterOptions, type MountedApplication, type MountedRouter, type Mutation, type MutationOptions, type MutationStatus, type Mutator, type NavigateOptions, NodeInstance, type NodeInstanceOptions, PageDSL, type PerfDiagnostic, type PerfDiagnosticCode, type PerfSnapshot, type PerfThresholds, type PerformancePanel, type PlanEntry, type Priority, ROUTER_OUTLET_ID, ReadonlySignal, type ReconcileResult, RenderContext, RenderHandle, type RequestConfig, type ResolvedConfig, type ResolvedTransitionLike, Resource, type ResourceInspection, type ResourceLike, ResourceLoaderContext, ResourceOptions, ResourceStatus, type RouteBuilder, type RouteContext, type RouteDefinition, type RouteMatch, type RouteMatchLike, type Router, type RouterHistory, type RouterInspection, type RouterLike, type RouterLocation, type RouterOptions, Runtime, RuntimeNodeInstance, type RuntimeOptions, Scheduler, type SchedulerDiagnostics, SemanticNodeType, ServerComment, ServerElement, ServerFragment, type ServerNode, type ServerNodeKind, type ServerParent, ServerRawHTML, ServerStyle, ServerText, type ShellBuilder, Signal, type SignalInspection, SignalKind, type SignalsPanel, Store, type StoreState, type StreetEvent, type StreetEventType, StreetFrameworkError, StreetRenderHandle, StreetRenderer, StreetRendererImpl, type StreetRendererOptions, type StreetUIConfig, type SubmitStatus, Subscriber, TransitionConfig, TransitionController, type TransitionHooks, type TransitionPhase, Unsubscribe, type Validator, a11yIds, applyNodeProps, applyProp, bindDomEvent, browserDOMAdapter, buttonUpdate, consoleDiagnosticSink, containFocus, createAnnouncer, createApplication, createAuthSession, createBrowserHistory, createClient, createContext, createDevTools, createForm, createI18n, createMemoryHistory, createRenderer, createRouter, createRuntime, createStore, createStreetEvent, defineConfig, describeError, diagnosePerformance, email, environment, escapeHtml, escapeHtmlAttr, escapeHtmlText, flushSync, focusById, focusFirst, focusInitial, formatDiagnosticContext, frameworkError, getFocusable, getResolvedTransition, globalEventBus, headingUpdate, hydrateGraph, inputUpdate, inspectApplication, inspectComponents, inspectContext, inspectForm, inspectGraph, inspectI18n, inspectInteractions, inspectResource, inspectRouter, inspectSignal, interpolate, linkUpdate, matchPattern, matchRoutes, maxLength, minLength, mountGraph, mountNode, mountRouter, mutation, nodeTypeStats, normalizePath, onEscape, patchNode, patchProp, pattern, printDiagnostics, printGraph, reconcileChildren, reconcileChildrenByPlan, renderDevToolsHTML, reportDiagnostic, reportError, required, resolveTag, restoreFocus, routerOutlet, rovingMenu, runElementTransition, runValidators, saveFocus, scheduleImmediate, scheduleUpdate, scheduler, serializeChildren, serializeServerNode, splitTarget, textUpdate, toIdToken, transformGraph, trapFocus, validateGraph, wireComponentBehavior, wireEvents, wireOverlayBehavior, wireReactiveList, wireSignalBindings };
