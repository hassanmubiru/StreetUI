import { a as Signal, b as Subscriber, U as Unsubscribe, R as ReadonlySignal, A as ApplicationId, D as DiagnosticCollector, c as ApplicationGraph, G as GraphNode, C as CompiledApplication, d as SemanticNodeType, P as PageDSL, e as ContainerDSL, f as SignalKind } from './compile-DGHUC0T6.cjs';
export { g as A11yOptions, h as AppBuilder, i as AppDSL, j as AppOptions, k as ApplicationGraphOptions, B as BaseNode, l as Bindable, m as BindableText, n as BoundInputOptions, o as ButtonOptions, p as CompileOptions, q as ContainerBuilder, r as ContainerBuilderImpl, s as ContainerOptions, t as ContentDSL, u as ControlledInputOptions, v as DerivedSignal, w as Diagnostic, x as DiagnosticError, y as DiagnosticLocation, z as DiagnosticSeverity, E as ErrorBoundaryOptions, F as ErrorFallbackBuilder, H as ErrorSource, I as EventDescriptor, J as FormBuilder, K as FormBuilderImpl, L as FormDSL, M as FormOptions, N as GraphNodeData, O as HandlerFn, Q as HeadingOptions, T as ImageOptions, W as InputOptions, X as InputOptionsBase, Y as LinkOptions, Z as ListBuilder, _ as ListBuilderImpl, $ as ListDSL, a0 as ListOptions, a1 as ListPlanEntry, a2 as NodeId, a3 as NodeMetadata, a4 as PageBuilder, a5 as PageBuilderImpl, a6 as PropValue, a7 as Props, a8 as ReactiveConsumer, a9 as ReactiveSource, aa as SectionBuilder, ab as SectionBuilderImpl, ac as SectionDSL, ad as SectionOptions, ae as SerializedGraph, af as SerializedNode, ag as StateRef, S as StreetApp, ah as StreetUI, ai as TextOptions, aj as TextValue, V as VERSION, ak as batch, al as compile, am as compileGraph, an as createNodeId, ao as derived, ap as effect, aq as formatDiagnostic, ar as generateApplicationId, as as generateNodeId, at as isBatching, au as nextId, av as nodeIdPrefix, aw as observerCount, ax as reactiveListItemKey, ay as reactiveListItemSignature, az as resetIdCounter, aA as signal, aB as signalKind, aC as streetui } from './compile-DGHUC0T6.cjs';
import { R as RenderHandle, S as StreetRenderer, a as HydrationDiagnosticSink } from './hydration-diagnostics-D9odszLZ.cjs';
export { H as HydrationDiagnostic, b as HydrationMismatchType, c as consoleHydrationDiagnosticSink, d as createHydrationDiagnosticCollector, f as formatHydrationDiagnostic } from './hydration-diagnostics-D9odszLZ.cjs';
import { D as DOMAdapter } from './server-CNgoINXH.cjs';
export { R as RenderToStringOptions, S as STATE_MARKER_ATTR, a as ServerDOMAdapter, r as readState, b as renderToString, s as serializeState, c as serverDOMAdapter } from './server-CNgoINXH.cjs';

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
    /** Id for a label element / labelling text. */
    readonly label: string;
    /** Id for descriptive/help text. */
    readonly description: string;
    /** Id for an error message element. */
    readonly error: string;
    /** Id for a title element (e.g. a dialog title). */
    readonly title: string;
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
 */
declare function a11yIds(base: string): A11yIds;

/**
 * Application and component lifecycle primitives.
 *
 * Lifecycle phases:
 *   created → mounted → active ⇄ updating → unmounting → destroyed
 */
type LifecyclePhase = 'created' | 'mounted' | 'active' | 'updating' | 'unmounting' | 'destroyed';
type LifecycleHook = () => void | Promise<void>;
declare class Lifecycle {
    private _phase;
    private readonly _hooks;
    get phase(): LifecyclePhase;
    get isMounted(): boolean;
    get isDestroyed(): boolean;
    on(phase: LifecyclePhase, hook: LifecycleHook): () => void;
    transition(to: LifecyclePhase): Promise<void>;
    onMount(hook: LifecycleHook): () => void;
    onUnmount(hook: LifecycleHook): () => void;
    onDestroy(hook: LifecycleHook): () => void;
}
/** A simple cleanup registry — collect teardown functions and run them all at once. */
declare class CleanupRegistry {
    private readonly _fns;
    add(fn: () => void): void;
    run(): void;
}

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
type ServerNodeKind = 'element' | 'text' | 'comment' | 'fragment';
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
/** Serialize a single server node (element/text/comment/fragment) to HTML. */
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
 * NodeInstance — the renderer's live counterpart to a GraphNode.
 *
 * Tracks the actual DOM node(s), all signal subscriptions that drive
 * targeted DOM updates, and DOM event listener teardowns.
 */

declare class NodeInstance {
    readonly graphNode: GraphNode;
    /** The primary DOM node for this instance (element or text node). */
    domNode: Node;
    readonly children: NodeInstance[];
    readonly cleanup: CleanupRegistry;
    constructor(graphNode: GraphNode, domNode: Node);
    addChild(child: NodeInstance): void;
    /** Subscribe to a signal; auto-cleanup on unmount. */
    trackSignal<T>(sig: ReadonlySignal<T>, handler: (v: T) => void): void;
    /** Register a raw cleanup fn (DOM event removal, etc.). */
    trackCleanup(fn: () => void): void;
    dispose(): void;
}

/**
 * RenderContext — shared state for a single mount operation.
 *
 * Passed through the render pipeline so every sub-function has access
 * to the DOM adapter, graph, and instance map without prop-drilling.
 */

interface RenderContext {
    readonly dom: DOMAdapter;
    readonly graph: ApplicationGraph;
    /** Maps GraphNode.id → its live NodeInstance */
    readonly instances: Map<string, NodeInstance>;
    /** The root container element. */
    readonly container: Element;
    /**
     * Optional dev-only sink that observes hydration mismatch repairs. When
     * absent (the default) the hydration path does no extra work — this is how
     * DevTools/diagnostics stay off the production runtime path.
     */
    readonly hydrationDiagnostics?: HydrationDiagnosticSink;
}
declare function createRenderContext(dom: DOMAdapter, graph: ApplicationGraph, container: Element, hydrationDiagnostics?: HydrationDiagnosticSink): RenderContext;

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
declare function applyNodeProps(ctx: RenderContext, graphNode: GraphNode, el: Element): void;
declare function wireSignalBindings(ctx: RenderContext, graphNode: GraphNode, instance: NodeInstance, onUpdate: (propKey: string, value: unknown) => void): void;
/**
 * Subscribe a reactive-list instance to its driving signal. On each change the
 * DSL-registered plan factory produces lightweight per-row descriptors, which
 * are reconciled against the live DOM with the keyed, minimal-move reconciler
 * (spec §15). A `conditional` node has no plan handler and falls back to the
 * eager build factory (it only ever renders 0..1 branch, so eager is fine).
 */
declare function wireReactiveList(ctx: RenderContext, graphNode: GraphNode, instance: NodeInstance, el: Element): void;

/**
 * Patch — targeted DOM updates driven by signal changes.
 *
 * When a signal fires, we look up the NodeInstance and apply
 * only the changed prop — no full re-render, no tree diffing.
 */

declare function patchNode(ctx: RenderContext, graphNode: GraphNode, propKey: string, newValue: unknown): void;

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
declare function reconcileChildren(ctx: RenderContext, parentDom: Element, oldInstances: NodeInstance[], newNodes: readonly GraphNode[], mountFn: MountFn): ReconcileResult;
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
declare function reconcileChildrenByPlan(ctx: RenderContext, parentDom: Element, oldInstances: NodeInstance[], plan: readonly PlanEntry[], mountFn: MountFn): ReconcileResult;

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
/** All panels captured at one `refresh()`. */
interface DevToolsSnapshot {
    readonly application: ApplicationPanel;
    readonly graph: InspectedNode;
    readonly signals: SignalsPanel;
    readonly performance: PerformancePanel;
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

export { type A11yIds, Application, ApplicationGraph, ApplicationId, type ApplicationIdentity, type ApplicationInspection, type ApplicationOptions, type ApplicationPanel, BrowserDOMAdapter, CleanupRegistry, CompiledApplication, ContainerDSL, type Context, type ContextInspection, type ContextLike, DEFAULT_PERF_THRESHOLDS, DOMAdapter, type DevToolsOptions, type DevToolsSession, type DevToolsSnapshot, type DevToolsSources, DiagnosticCollector, type DiagnosticContext, type DiagnosticSink, type DiagnosticsSummary, type DomBinding, DomEventRegistry, Environment, type EnvironmentCapabilities, type EnvironmentKind, EventBus, type EventHandler, FOCUSABLE_SELECTOR, type Field, type Form, type FormConfig, type FormInspection, type FormLike, type FormValidators, type FormValues, GraphNode, HydrationDiagnosticSink, type I18n, type I18nConfig, type I18nInspection, type I18nLike, type InspectFormOptions, type InspectI18nOptions, type InspectResourceOptions, type InspectSignalOptions, type InspectedNode, type InspectedPage, type InterpolationParams, type IsActiveOptions, type Job, Lifecycle, type LifecycleHook, type LifecyclePhase, type MatchResult, type MessageMap, type MountFn, type MountRouterOptions, type MountedApplication, type MountedRouter, type NavigateOptions, NodeInstance, type NodeInstanceOptions, PageDSL, type PerfDiagnostic, type PerfDiagnosticCode, type PerfSnapshot, type PerfThresholds, type PerformancePanel, type PlanEntry, type Priority, ROUTER_OUTLET_ID, ReadonlySignal, type ReconcileResult, type RenderContext, RenderHandle, type ResolvedConfig, type Resource, type ResourceInspection, type ResourceLike, type ResourceLoader, type ResourceLoaderContext, type ResourceOptions, type ResourceStatus, type RouteBuilder, type RouteContext, type RouteDefinition, type RouteMatch, type RouteMatchLike, type Router, type RouterHistory, type RouterInspection, type RouterLike, type RouterLocation, type RouterOptions, Runtime, RuntimeNodeInstance, type RuntimeOptions, Scheduler, type SchedulerDiagnostics, SemanticNodeType, ServerComment, ServerElement, ServerFragment, type ServerNode, type ServerNodeKind, type ServerParent, ServerStyle, ServerText, type ShellBuilder, Signal, type SignalInspection, SignalKind, type SignalsPanel, Store, type StoreState, type StreetEvent, type StreetEventType, StreetFrameworkError, StreetRenderHandle, StreetRenderer, StreetRendererImpl, type StreetRendererOptions, type StreetUIConfig, type SubmitStatus, Subscriber, Unsubscribe, type Validator, a11yIds, applyNodeProps, applyProp, bindDomEvent, browserDOMAdapter, buttonUpdate, consoleDiagnosticSink, createApplication, createBrowserHistory, createContext, createDevTools, createForm, createI18n, createMemoryHistory, createRenderContext, createRenderer, createRouter, createRuntime, createStore, createStreetEvent, defineConfig, diagnosePerformance, email, environment, escapeHtmlAttr, escapeHtmlText, flushSync, focusById, focusFirst, formatDiagnosticContext, frameworkError, globalEventBus, headingUpdate, hydrateGraph, inputUpdate, inspectApplication, inspectContext, inspectForm, inspectGraph, inspectI18n, inspectResource, inspectRouter, inspectSignal, interpolate, matchPattern, matchRoutes, maxLength, minLength, mountGraph, mountNode, mountRouter, nodeTypeStats, normalizePath, patchNode, patchProp, pattern, printDiagnostics, printGraph, reconcileChildren, reconcileChildrenByPlan, reportDiagnostic, required, resolveTag, resource, routerOutlet, runValidators, scheduleImmediate, scheduleUpdate, scheduler, serializeChildren, serializeServerNode, splitTarget, textUpdate, toIdToken, transformGraph, validateGraph, wireEvents, wireReactiveList, wireSignalBindings };
