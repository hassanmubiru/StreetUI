/**
 * The single authoritative StreetUI framework version.
 *
 * This constant is the one source of truth for the version of the shipped
 * `streetui` package. It is kept in lock-step with this package's
 * `package.json` `version` field and with the bundled CLI's reported version
 * (`streetui --version`) — the consolidated test-suite pins all three to the
 * same coordinated release so they can never silently drift apart.
 */
declare const VERSION = "2.1.0";

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
 * Node and application identity utilities.
 * Every node in the semantic graph has a stable, unique identity.
 */
/** Generate a framework-internal monotonic integer ID. */
declare function nextId(): number;
/** Reset the counter (test use only). */
declare function resetIdCounter(): void;
/** Opaque branded type for node IDs. */
type NodeId = string & {
    readonly __brand: 'NodeId';
};
/** Create a NodeId from a string (must be unique at call site). */
declare function createNodeId(value: string): NodeId;
/** Generate a fresh, unique NodeId. */
declare function generateNodeId(prefix?: string): NodeId;
/** Parse the prefix from a NodeId. */
declare function nodeIdPrefix(id: NodeId): string;
/** Branded type for application IDs. */
type ApplicationId = string & {
    readonly __brand: 'ApplicationId';
};
/** Generate a fresh application ID. */
declare function generateApplicationId(name: string): ApplicationId;

/**
 * Framework diagnostics — structured errors, warnings, and hints
 * that flow through the compiler, validator, and runtime.
 */
type DiagnosticSeverity = 'error' | 'warning' | 'info';
interface DiagnosticLocation {
    readonly file?: string;
    readonly line?: number;
    readonly column?: number;
    readonly nodeId?: string;
}
interface Diagnostic {
    readonly severity: DiagnosticSeverity;
    readonly code: string;
    readonly message: string;
    readonly location: DiagnosticLocation | undefined;
    readonly cause: unknown;
}
declare class DiagnosticError extends Error {
    readonly diagnostics: readonly Diagnostic[];
    constructor(diagnostics: readonly Diagnostic[]);
}
declare class DiagnosticCollector {
    private readonly _diagnostics;
    get diagnostics(): readonly Diagnostic[];
    get hasErrors(): boolean;
    get hasWarnings(): boolean;
    error(code: string, message: string, location?: DiagnosticLocation, cause?: unknown): void;
    warn(code: string, message: string, location?: DiagnosticLocation): void;
    info(code: string, message: string, location?: DiagnosticLocation): void;
    merge(other: DiagnosticCollector): void;
    throwIfErrors(): void;
    clear(): void;
}
/** Format a single diagnostic as a human-readable string. */
declare function formatDiagnostic(d: Diagnostic): string;

/**
 * Framework node primitives — the base abstraction for every node
 * in the Semantic Application Graph.
 */

type SemanticNodeType = 'application' | 'page' | 'section' | 'container' | 'heading' | 'text' | 'button' | 'input' | 'form' | 'list' | 'list-item' | 'image' | 'link' | 'component' | 'slot' | 'fragment' | 'reactive-list' | 'conditional' | 'portal' | 'head';
interface NodeMetadata {
    readonly createdAt: number;
    readonly [key: string]: unknown;
}
declare abstract class BaseNode {
    readonly id: NodeId;
    readonly type: SemanticNodeType;
    readonly metadata: NodeMetadata;
    constructor(type: SemanticNodeType, id?: NodeId);
    abstract clone(): BaseNode;
}

/**
 * Semantic Application Graph nodes.
 *
 * Every element in a StreetUI application is represented as a GraphNode.
 * Nodes form a tree: each has an optional parent and an ordered list of children.
 */

type PropValue = string | number | boolean | null | undefined | string[] | number[] | Record<string, unknown>;
type Props = Record<string, PropValue>;
interface EventDescriptor {
    readonly type: string;
    /** Reference key into the application's handler registry. */
    readonly handlerKey: string;
}
interface StateRef {
    /** ID of the signal/store this node's property is bound to. */
    readonly signalId: string;
    /** The prop key on this node that is bound. */
    readonly propKey: string;
}
interface GraphNodeData {
    readonly id: NodeId;
    readonly type: SemanticNodeType;
    readonly key: string | undefined;
    props: Props;
    events: EventDescriptor[];
    stateRefs: StateRef[];
    children: GraphNode[];
    parent: GraphNode | null;
}
declare class GraphNode implements GraphNodeData {
    readonly id: NodeId;
    readonly type: SemanticNodeType;
    readonly key: string | undefined;
    props: Props;
    events: EventDescriptor[];
    stateRefs: StateRef[];
    children: GraphNode[];
    parent: GraphNode | null;
    constructor(type: SemanticNodeType, options?: {
        id?: NodeId;
        key?: string;
        props?: Props;
        events?: EventDescriptor[];
        stateRefs?: StateRef[];
    });
    appendChild(child: GraphNode): void;
    insertBefore(child: GraphNode, reference: GraphNode): void;
    removeChild(child: GraphNode): void;
    replaceChild(newChild: GraphNode, oldChild: GraphNode): void;
    setProp(key: string, value: PropValue): void;
    getProp<T extends PropValue = PropValue>(key: string): T | undefined;
    addEvent(descriptor: EventDescriptor): void;
    removeEvent(type: string): void;
    get isLeaf(): boolean;
    get depth(): number;
    get root(): GraphNode;
    /** Shallow clone — does not clone children. */
    shallowClone(): GraphNode;
}

/**
 * The Semantic Application Graph.
 *
 * Holds the application root node and all its descendants.
 * Supports traversal, lookup by ID, validation, and serialization.
 */

interface ApplicationGraphOptions {
    readonly name: string;
    readonly version?: string;
}
interface HandlerFn {
    (...args: unknown[]): unknown;
}
declare class ApplicationGraph {
    readonly root: GraphNode;
    readonly name: string;
    readonly version: string;
    private readonly _nodeIndex;
    /** Handler registry — maps handlerKey → actual function */
    readonly handlers: Map<string, HandlerFn>;
    constructor(options: ApplicationGraphOptions);
    createNode(type: GraphNode['type'], options?: {
        key?: string;
        props?: Props;
        parent?: GraphNode;
    }): GraphNode;
    attachNode(node: GraphNode, parent: GraphNode): void;
    detachNode(node: GraphNode): void;
    private _removeFromIndex;
    /**
     * Remove every handler-registry entry owned by a single node. A node owns:
     *  - one entry per event descriptor (its `handlerKey`),
     *  - one `__signal__<signalId>` entry per state ref (signalIds are namespaced
     *    by node id, so they are never shared between nodes), and
     *  - a `__listbuild__<id>` entry if it is a reactive-list.
     * Called for every node in a detached subtree so removing list items (or
     * discarding freshly-built-but-unadopted item subtrees) leaves no stale
     * registrations behind.
     */
    private _unregisterNodeHandlers;
    registerHandler(key: string, fn: HandlerFn): void;
    getHandler(key: string): HandlerFn | undefined;
    /** True if a handler is currently registered under `key`. Inspection helper. */
    hasHandler(key: string): boolean;
    /** Number of currently-registered handlers. Inspection helper. */
    get handlerCount(): number;
    findById(id: NodeId): GraphNode | undefined;
    findAll(predicate: (node: GraphNode) => boolean): GraphNode[];
    findByType(type: GraphNode['type']): GraphNode[];
    walk(visitor: (node: GraphNode, depth: number) => void): void;
    private _walk;
    get nodeCount(): number;
    validate(): DiagnosticCollector;
    serialize(): SerializedGraph;
    private _serializeNode;
}
interface SerializedNode {
    readonly id: string;
    readonly type: string;
    readonly key: string | undefined;
    readonly props: Props;
    readonly events: EventDescriptor[];
    readonly stateRefs: unknown[];
    readonly children: SerializedNode[];
}
interface SerializedGraph {
    readonly name: string;
    readonly version: string;
    readonly root: SerializedNode;
}

/**
 * First-class StreetUI-native components (§3–§9).
 *
 * A component is a *reusable unit that owns its own local state and lifecycle*.
 * It is NOT a virtual-DOM element, a second reactive system, or a second
 * renderer. It compiles into the EXISTING pipeline: `container.component(...)`
 * creates a reserved `'component'` GraphNode (already a `SemanticNodeType`,
 * already mapped to `<div>`), runs the component's `setup` synchronously during
 * the same build-time descent every other builder uses, and routes any cleanups
 * the setup registers into the node's `NodeInstance` at mount (so they run,
 * children-first, when the component leaves the graph).
 *
 * Design (derived from the existing DSL architecture, not copied from React/Vue):
 *
 *   const UserCard = component<{ name: Signal<string> }>((props, ctx) => {
 *     // ── setup: runs ONCE per instance, at build time ──
 *     const open = signal(false);
 *     ctx.effect(() => { ... });            // auto-disposed on unmount
 *     ctx.onCleanup(() => { ... });         // explicit teardown hook
 *     // ── render: fills the component's own container scope ──
 *     return (content) => {
 *       content.text(props.name);           // fine-grained: signal prop, no re-setup
 *       content.when(open, (c) => c.text('expanded'));
 *       ctx.renderChildren(content);        // where slotted children go (§6)
 *     };
 *   }, { name: 'UserCard' });
 *
 *   page.component('card-1', UserCard, { name }, (slot) => slot.text('child'));
 *
 * Props are ordinary typed values (§5 — typing is a TypeScript concern, no
 * runtime schema). Passing a `Signal<T>` prop and binding it in the render body
 * gives fine-grained updates (§13) WITHOUT re-running `setup`: only the bound
 * node mutates when the signal changes. `setup` re-runs only when the component
 * is genuinely rebuilt (removed + re-created by a keyed list / conditional),
 * at which point the previous instance is disposed first — so cleanup stays
 * correct.
 */

/**
 * The render half of a component: fills the component's own container scope.
 * Returned by `setup` so that per-instance state created in `setup` is captured
 * by closure and the render body can read it.
 */
type ComponentRender = (content: ContainerDSL) => void;
/**
 * Lifecycle + composition surface handed to a component's `setup`. Local
 * reactive state is created with the EXISTING `signal`/`derived`/`effect`/
 * `batch` primitives (§8) — `ctx` only adds ownership: anything registered here
 * is torn down automatically when the component leaves the graph (§9).
 */
interface ComponentContext {
    /** This instance's stable identity key (the `key` passed at the call site). */
    readonly key: string;
    /**
     * Register a teardown callback. Runs when the component unmounts (children
     * first, then this — mirroring `NodeInstance.dispose`). Use for resources,
     * `form.dispose`, subscriptions, timers, etc.
     */
    onCleanup(fn: () => void): void;
    /**
     * Run a reactive effect owned by this component. Wraps the framework's
     * `effect()`; the returned unsubscribe is auto-tracked and disposed on
     * unmount, so component effects never leak (the pain point the audit ranked
     * #1). The effect may itself return a cleanup, exactly like `effect()`.
     */
    effect(fn: () => void | (() => void)): void;
    /**
     * Render the caller-supplied children into `content` at this point (§6 native
     * child composition / slots). No-op when the call site passed no children.
     * Call it wherever the component wants its slotted content to appear.
     */
    renderChildren(content: ContainerDSL): void;
}
/**
 * A component's setup function: receives typed props and the lifecycle context,
 * creates any local state, and returns the render function. Runs synchronously
 * during the build-time descent (like `errorBoundary`'s callback), so it must be
 * SSR-safe — on the server it runs at render time and its cleanups run when the
 * SSR root is disposed.
 */
type ComponentSetup<P> = (props: P, ctx: ComponentContext) => ComponentRender;
/**
 * The opaque, reusable definition produced by `component(...)`. Carries the
 * `setup` and an inspectable `name`; the brand lets the builder method (and
 * DevTools) recognise a definition at runtime without a class.
 */
interface ComponentDefinition<P> {
    readonly __streetui_component: true;
    readonly name: string;
    readonly setup: ComponentSetup<P>;
}
/**
 * Define a reusable component. Returns a `ComponentDefinition` you render with
 * `container.component(key, def, props, children?)`. This is a pure factory — it
 * builds no graph and runs no `setup`; instantiation happens per call site.
 *
 * @param setup  Runs once per instance: create local state, return the render fn.
 * @param options.name  Human-readable name for DevTools/`data-streetui-component`.
 */
declare function component<P = Record<string, never>>(setup: ComponentSetup<P>, options?: {
    name?: string;
}): ComponentDefinition<P>;
/** Runtime guard: is `value` a component definition? */
declare function isComponentDefinition(value: unknown): value is ComponentDefinition<unknown>;

/**
 * Transition configuration (§2, §4).
 *
 * A `TransitionConfig` is a pure, declarative description of a CSS class-based
 * enter/leave transition — the engine choice for this milestone. It contains NO
 * DOM references, NO timers and NO browser-only APIs, so it is safe to build on
 * the server (where it is simply ignored — see the renderer's SSR guard) and to
 * carry on a graph handler (`__transition__<nodeId>`) alongside the existing
 * `__overlay__`/`__component__` descriptors.
 *
 * The class model follows the widely-understood enter/leave convention:
 *
 *   enter:  [enterActive (+ enter) whole phase] · enterFrom (start) → enterTo (end)
 *   leave:  [leaveActive (+ leave) whole phase] · leaveFrom (start) → leaveTo (end)
 *
 * `name` is a shorthand that expands to `${name}-enter-from`,
 * `${name}-enter-active`, `${name}-enter-to` and the leave equivalents; explicit
 * class fields override the derived ones. Because the classes are just strings,
 * SSR output is deterministic (no class is applied on the server at all — the
 * controller is browser-only), satisfying §4/§21.
 */
interface TransitionConfig {
    /** Shorthand base: expands to `${name}-enter-from`, `${name}-enter-active`, … */
    readonly name?: string;
    /** Class(es) present for the whole enter phase (in addition to `enterActive`). */
    readonly enter?: string;
    /** Class(es) applied at the start of enter, removed on the next frame. */
    readonly enterFrom?: string;
    /** Class(es) present for the whole enter phase (where the CSS `transition` lives). */
    readonly enterActive?: string;
    /** Class(es) added on the next frame, removed when enter completes. */
    readonly enterTo?: string;
    /** Class(es) present for the whole leave phase (in addition to `leaveActive`). */
    readonly leave?: string;
    /** Class(es) applied at the start of leave, removed on the next frame. */
    readonly leaveFrom?: string;
    /** Class(es) present for the whole leave phase (where the CSS `transition` lives). */
    readonly leaveActive?: string;
    /** Class(es) added on the next frame, removed when leave completes. */
    readonly leaveTo?: string;
    /**
     * Also animate the very first appearance (initial mount). Hydration never
     * animates appear (the DOM is already present and correct); this only affects
     * fresh browser mounts. Defaults to false.
     */
    readonly appear?: boolean;
    /**
     * Fallback completion timeout in milliseconds. A transition normally completes
     * on the element's `transitionend`/`animationend`. This timeout is the safety
     * net for (a) transitions that fire no such event and (b) test DOMs like
     * happy-dom that dispatch no transition events at all — making tests
     * deterministic without a real browser (§24). Defaults to 1000. Use a small
     * value (or 0 → next macrotask) in tests.
     */
    readonly duration?: number;
}
/**
 * The resolved, ready-to-apply form of a {@link TransitionConfig}: each phase's
 * classes are pre-split into arrays so the controller applies/removes them with
 * no per-run string parsing. Produced once by {@link resolveTransition} at wire
 * time (browser only).
 */
interface ResolvedTransition {
    /** enter classes present for the whole phase (base `enter` + `enterActive`). */
    readonly enterActive: readonly string[];
    /** enter start classes (removed next frame). */
    readonly enterFrom: readonly string[];
    /** enter end classes (added next frame). */
    readonly enterTo: readonly string[];
    readonly leaveActive: readonly string[];
    readonly leaveFrom: readonly string[];
    readonly leaveTo: readonly string[];
    readonly appear: boolean;
    readonly duration: number;
}
/**
 * Resolve a {@link TransitionConfig} into applied class arrays. The `name`
 * shorthand supplies defaults; any explicit field overrides the derived class
 * for that phase-slot (still merged with `enter`/`leave` base classes).
 */
declare function resolveTransition(config: TransitionConfig): ResolvedTransition;
/** Runtime brand check for a transition descriptor value. */
declare function isTransitionConfig(value: unknown): value is TransitionConfig;

/**
 * Document head / metadata model (2.0 §1–§3).
 *
 * `head({...})` is a first-class StreetUI primitive for declaring document
 * metadata — title, meta, link, canonical, Open Graph, Twitter/X, robots,
 * theme-color and favicon. It is NOT a copy of another framework's API: it is
 * expressed on StreetUI's own component/graph model. A `head()` call creates a
 * `'head'` graph node (rendered as a neutral inline anchor, like a portal) and
 * registers a `__head__<nodeId>` descriptor — exactly the handler-registry
 * convention used by `__overlay__`/`__transition__`/`__component__`. The
 * renderer reads that descriptor to:
 *
 *   • apply the contribution to `document.head` on the browser
 *     (`wireHeadBehavior`), adopting server-emitted tags on hydration so there
 *     are no duplicates, and cleaning up its own tags on unmount / route change;
 *   • emit only the active graph's merged metadata as an HTML string on the
 *     server (`renderHead`).
 *
 * This module is pure and DOM-free (like `transition.ts`): it defines the config
 * shape and normalises it into an ordered list of {@link HeadEntry} with stable
 * *dedup keys*. All merge/precedence/DOM work happens in the renderer, keyed by
 * these entries.
 *
 * ── Deduplication & precedence (§3) ──────────────────────────────────────────
 * Every entry carries a `dedupKey`. When several `head()` nodes are live at once
 * (e.g. an app-level default, a route-level `head()`, and a component-level
 * `head()`), the renderer merges all of their entries and, for each `dedupKey`,
 * the LAST contribution in document order wins. Document order is pre-order DFS
 * = mount order, so a `head()` declared deeper/later (a route or a component
 * nested inside the app shell) deterministically overrides an app-level default
 * for the same key. Removing that node (navigating away, unmounting the
 * component) re-exposes the previously-shadowed default. `<title>` and each
 * single-instance meta/link (description, robots, theme-color, viewport,
 * charset, canonical, favicon, and each og: or twitter: property) collapse to one
 * effective tag; generic `meta[]`/`link[]` array entries are keyed by their
 * identifying attributes so independent tags coexist.
 */

/** A head value that may be a literal string or a reactive signal of a string. */
type BindableString = string | ReadonlySignal<string> | Signal<string>;
/** A single `<meta>` descriptor. Provide exactly one identifying key. */
interface MetaDescriptor {
    /** `name="…"` (e.g. "description", "robots", "theme-color", "twitter:card"). */
    readonly name?: string;
    /** `property="…"` (e.g. "og:title", "og:image") — the Open Graph convention. */
    readonly property?: string;
    /** `http-equiv="…"` (e.g. "content-security-policy"). */
    readonly httpEquiv?: string;
    /** `charset="…"` (e.g. "utf-8"). Standalone; no `content`. */
    readonly charset?: string;
    /** The tag's `content`. May be reactive. */
    readonly content?: BindableString;
}
/** A single `<link>` descriptor. `rel`+`href` identify it. */
interface LinkDescriptor {
    readonly rel: string;
    readonly href: string;
    readonly sizes?: string;
    readonly type?: string;
    readonly media?: string;
    readonly as?: string;
    readonly crossorigin?: string;
    readonly hreflang?: string;
}
/**
 * Declarative document metadata. Every field is optional; convenience fields
 * (title/description/canonical/robots/themeColor/viewport/charset/favicon/
 * openGraph/twitter) expand into the same normalized entries as the raw
 * `meta`/`link` arrays, with single-instance dedup keys so a later `head()`
 * cleanly overrides an earlier one.
 */
interface HeadMetadata {
    /** `<title>` text. May be reactive. Single-instance (dedup key `title`). */
    readonly title?: BindableString;
    /** `<meta name="description">`. May be reactive. */
    readonly description?: BindableString;
    /** `<link rel="canonical">` href. */
    readonly canonical?: string;
    /** `<meta name="robots">` (e.g. "index,follow" / "noindex"). */
    readonly robots?: string;
    /** `<meta name="theme-color">`. */
    readonly themeColor?: string;
    /** `<meta name="viewport">`. */
    readonly viewport?: string;
    /** `<meta charset>`. */
    readonly charset?: string;
    /** Favicon: a shorthand for `<link rel="icon">`. String = href, or a full descriptor. */
    readonly favicon?: string | LinkDescriptor;
    /** Open Graph properties — each key `k` becomes `<meta property="og:k">`. Values may be reactive. */
    readonly openGraph?: Readonly<Record<string, BindableString>>;
    /** Twitter/X card properties — each key `k` becomes `<meta name="twitter:k">`. Values may be reactive. */
    readonly twitter?: Readonly<Record<string, BindableString>>;
    /** Raw `<meta>` tags (for anything the convenience fields don't cover). */
    readonly meta?: readonly MetaDescriptor[];
    /** Raw `<link>` tags (stylesheets, preload, alternate, etc.). */
    readonly link?: readonly LinkDescriptor[];
    /** `<base href>` — single-instance. */
    readonly base?: string;
}
/**
 * A normalized head tag: one `<title>`, `<meta>`, `<link>` or `<base>`. Attr
 * values and the title's text may still be reactive (`BindableString`); the
 * renderer peeks them for SSR and subscribes to them on the browser. `dedupKey`
 * is what the merge collapses on.
 */
interface HeadEntry {
    readonly tag: 'title' | 'meta' | 'link' | 'base';
    readonly dedupKey: string;
    /** Static + reactive attributes (no `undefined` values). */
    readonly attrs: Readonly<Record<string, BindableString>>;
    /** Text content — only meaningful for `tag === 'title'`. */
    readonly text?: BindableString;
}
/** The value a `__head__<id>` handler returns: this node's ordered contribution. */
interface HeadContribution {
    readonly entries: readonly HeadEntry[];
}
/**
 * Normalise a {@link HeadMetadata} into an ordered list of {@link HeadEntry}.
 * Emission order within one `head()` is: charset → base → title → description →
 * canonical → robots → theme-color → viewport → favicon → openGraph → twitter →
 * explicit meta[] → explicit link[]. (Merge across nodes is document order; this
 * per-node order only affects the sequence of same-priority tags.)
 */
declare function resolveHead(config: HeadMetadata): HeadContribution;
/** Runtime brand check for a head-contribution descriptor value. */
declare function isHeadContribution(value: unknown): value is HeadContribution;

/**
 * StreetUI DSL type system.
 * All builder callbacks and option shapes live here.
 */

type Bindable<T> = T | ReadonlySignal<T> | Signal<T>;
type TextValue = string | number | boolean;
type BindableText = TextValue | ReadonlySignal<TextValue>;
/**
 * Accessibility options shared by every element builder.
 *
 * These map to standard HTML/ARIA attributes and flow straight through to the
 * DOM via the renderer's generic attribute pass — there is no separate ARIA
 * abstraction to keep in sync. Prefer semantic HTML (button/a/input/etc.) and
 * only reach for these when semantics alone are insufficient. `id` (already
 * present on each option type) combined with the deterministic `a11yIds()`
 * helper in `streetui` is how label/description/title associations are
 * wired in an SSR/hydration-safe way.
 */
interface A11yOptions {
    /** ARIA role (e.g. 'dialog', 'alert', 'status', 'navigation'). */
    readonly role?: string;
    /** tabindex value. Use 0 to make an element focusable, -1 to remove from tab order. */
    readonly tabIndex?: number;
    /** aria-label — an accessible name when no visible label element exists. */
    readonly ariaLabel?: string;
    /** aria-labelledby — id(s) of the element(s) that label this one. */
    readonly ariaLabelledBy?: string;
    /** aria-describedby — id(s) of the element(s) that describe this one. */
    readonly ariaDescribedBy?: string;
    /** aria-expanded — for disclosure widgets (rendered as the string "true"/"false"). */
    readonly ariaExpanded?: boolean;
    /** aria-controls — id of the element this one controls. */
    readonly ariaControls?: string;
    /** aria-hidden — hide decorative content from assistive tech. */
    readonly ariaHidden?: boolean;
    /** aria-live — announce dynamic changes ('polite' | 'assertive' | 'off'). */
    readonly ariaLive?: 'off' | 'polite' | 'assertive';
    /** aria-current — mark the current item in a set (e.g. 'page' for active nav). */
    readonly ariaCurrent?: boolean | 'page' | 'step' | 'location' | 'date' | 'time';
    /** aria-invalid — mark a form field as failing validation. */
    readonly ariaInvalid?: boolean;
    /** aria-required — mark a form field as required. */
    readonly ariaRequired?: boolean;
    /** aria-modal — mark a dialog as modal (content outside is inert to AT). */
    readonly ariaModal?: boolean;
    /** aria-owns — id(s) of elements owned by this one when the DOM can't express it. */
    readonly ariaOwns?: string;
    /** aria-activedescendant — id of the active option in a composite widget (menu/listbox/combobox). */
    readonly ariaActiveDescendant?: string;
    /** aria-haspopup — the element opens a popup ('menu' | 'listbox' | 'dialog' | 'grid' | 'tree' | true). */
    readonly ariaHasPopup?: boolean | 'menu' | 'listbox' | 'tree' | 'grid' | 'dialog';
    /** aria-selected — selection state within a composite widget. */
    readonly ariaSelected?: boolean;
}
interface TextOptions extends A11yOptions {
    readonly class?: string;
    readonly id?: string;
}
interface HeadingOptions extends TextOptions {
    readonly level?: 1 | 2 | 3 | 4 | 5 | 6;
}
interface ButtonOptions extends A11yOptions {
    readonly class?: string;
    readonly id?: string;
    readonly disabled?: Bindable<boolean>;
    readonly onClick?: () => void;
}
interface InputOptionsBase extends A11yOptions {
    readonly class?: string;
    readonly id?: string;
    readonly type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search';
    readonly placeholder?: string;
    readonly disabled?: Bindable<boolean>;
    readonly onChange?: (value: string) => void;
}
/**
 * Explicitly-controlled input: supply `value` and/or `onInput` yourself.
 * `bind` is disallowed here (typed as `never`) so a two-way `bind` can never be
 * combined with manual `value`/`onInput` wiring — the ambiguity is rejected by
 * the type checker rather than resolved silently at runtime.
 */
interface ControlledInputOptions extends InputOptionsBase {
    readonly value?: Bindable<string>;
    readonly onInput?: (value: string) => void;
    readonly bind?: never;
}
/**
 * Two-way bound input: `bind` expands to `value` (read) + an input handler that
 * writes the field value back into the signal. Manual `value`/`onInput` are
 * disallowed here to keep the binding unambiguous.
 */
interface BoundInputOptions extends InputOptionsBase {
    readonly bind: Signal<string>;
    readonly value?: never;
    readonly onInput?: never;
}
type InputOptions = ControlledInputOptions | BoundInputOptions;
interface LinkOptions extends A11yOptions {
    readonly class?: string;
    readonly id?: string;
    readonly href: string;
    readonly external?: boolean;
    readonly onClick?: () => void;
}
interface ImageOptions extends A11yOptions {
    readonly class?: string;
    readonly id?: string;
    readonly src: string;
    readonly alt: string;
    readonly width?: number;
    readonly height?: number;
}
interface ContainerOptions extends A11yOptions {
    readonly class?: string;
    readonly id?: string;
    readonly key?: string;
    /**
     * Enter/leave transition for this element (§2). CSS class-based and
     * browser-only: on the server it is ignored (deterministic SSR output). The
     * enter animation runs when the element is added by a reactive `when`/`listOf`
     * change (or on initial mount when `appear` is set); the leave animation runs
     * before the element is removed and disposed — the reconciler defers teardown
     * until the transition completes.
     */
    readonly transition?: TransitionConfig;
}
interface SectionOptions extends ContainerOptions {
}
interface FormOptions extends ContainerOptions {
    readonly onSubmit?: (e: Event) => void;
}
interface ListOptions extends ContainerOptions {
    /**
     * Enter/leave transition applied to each list item (§7). Preserves keyed
     * identity: reordering reuses items (no leave/enter), append/prepend enter,
     * remove leaves before disposal, and a removed key that reappears mid-leave is
     * reclaimed (leave→enter). `transition` (inherited) applies to the list
     * container itself; `itemTransition` applies to its rows.
     */
    readonly itemTransition?: TransitionConfig;
}
/** Options for `when()` (§2 conditional transitions). */
interface WhenOptions {
    /** Transition applied to the active branch as it mounts/unmounts. */
    readonly transition?: TransitionConfig;
    /** Also animate the branch present on the initial mount (appear). */
    readonly appear?: boolean;
}
/** Options for a plain portal (mount children into `document.body`). */
interface PortalOptions extends ContainerOptions {
}
/**
 * Options shared by every overlay (dialog/popover/tooltip/dropdown/toast).
 *
 * An overlay is a portal + a reactive `when(open, …)` panel + focus/keyboard
 * behavior. `open` drives visibility; the framework never mutates it — closing
 * is cooperative: `onClose` fires on Escape (when `closeOnEscape`) and the app
 * flips its own `open` signal there. Per-kind defaults (role, modality, focus,
 * escape, restore) apply unless overridden here.
 */
interface OverlayOptions extends ContainerOptions {
    /** Reactive open/visibility state. When it flips, the panel mounts/unmounts. */
    readonly open: Bindable<boolean>;
    /** Requested-close callback (fired on Escape when `closeOnEscape`). Flip `open` here. */
    readonly onClose?: () => void;
    /** Restore focus to the previously-focused element on close. Default: per-kind. */
    readonly restoreFocus?: boolean;
    /** id of the element to focus first when the overlay opens (else first focusable). */
    readonly initialFocusId?: string;
    /** Escape key invokes `onClose`. Default: per-kind. */
    readonly closeOnEscape?: boolean;
}
type SectionBuilder = (section: SectionDSL) => void;
type ContainerBuilder = (container: ContainerDSL) => void;
type PageBuilder = (page: PageDSL) => void;
type FormBuilder = (form: FormDSL) => void;
type ListBuilder = (list: ListDSL) => void;
/** A reactive source of error state (e.g. `resource.error`). `null`/`undefined` means "no error". */
type ErrorSource = ReadonlySignal<unknown>;
/** Fallback UI builder — receives the current error and a `retry` callback. */
type ErrorFallbackBuilder = (fallback: ContainerDSL, error: unknown, retry: () => void) => void;
interface ErrorBoundaryOptions {
    /** Renders when the boundary is in an error state. */
    readonly fallback: ErrorFallbackBuilder;
    /**
     * Reactive error source(s) to observe — typically a resource's `error` signal.
     * When any becomes non-null, the fallback replaces the body.
     */
    readonly source?: ErrorSource | ReadonlyArray<ErrorSource>;
    /** Invoked by the fallback's `retry()`, before the body is re-attempted (e.g. `resource.refetch`). */
    readonly onRetry?: () => void;
    /**
     * Error-reporting hook (§6/§7). Called with the current error each time the
     * boundary ENTERS its error state (i.e. when the fallback mounts), including
     * on a re-entry after a failed retry. Use it to forward the error to a
     * production diagnostics sink. It observes only — it never changes the
     * boundary's behavior, and receives the same `unknown` error the fallback
     * sees (no sensitive framework internals are injected).
     */
    readonly onError?: (error: unknown) => void;
}
/**
 * Branch builders for {@link ContainerDSL.asyncBoundary} — the loading / error /
 * success states of a {@link Resource}. This is deliberately NOT a new async
 * system: it is thin sugar over the existing `resource` state machine and
 * `when()`. Exactly one branch is live at a time, chosen by the resource's
 * reactive `status`/`data` (error takes precedence, then resolved data, then
 * loading), so mounting/unmounting and cleanup all reuse the conditional
 * machinery. Branch signature mirrors `errorBoundary`'s fallback: the content
 * scope comes first.
 */
interface AsyncBoundaryBranches<T> {
    /** Shown while the resource is idle or performing its first load (no data yet). */
    readonly loading?: (content: ContainerDSL) => void;
    /**
     * Shown while the resource is in its error state. Receives the current error
     * and a `retry()` that re-runs the loader (a thin wrapper over `refetch`).
     */
    readonly error?: (content: ContainerDSL, error: unknown, retry: () => void) => void;
    /**
     * Shown once the resource has data (including while a refetch keeps the old
     * value visible). Receives the data as a `ReadonlySignal<T>` so the branch can
     * bind it reactively and update in place without remounting.
     */
    readonly success: (content: ContainerDSL, data: ReadonlySignal<T>) => void;
}
interface ContentDSL {
    heading(text: BindableText, options?: HeadingOptions): void;
    text(content: BindableText, options?: TextOptions): void;
    button(label: BindableText, options?: ButtonOptions): void;
    input(options?: InputOptions): void;
    image(options: ImageOptions): void;
    link(label: BindableText, options: LinkOptions): void;
}
interface ContainerDSL extends ContentDSL {
    section(key: string, builder: SectionBuilder, options?: SectionOptions): void;
    container(key: string, builder: ContainerBuilder, options?: ContainerOptions): void;
    list(key: string, builder: ListBuilder, options?: ListOptions): void;
    /**
     * Reactive list driven by a Signal<T[]>.
     * When the signal value changes, the list is reconciled against the new items.
     * The renderItem callback receives each item and a ContentDSL to build children.
     */
    listOf<T>(key: string, items: Signal<T[]> | ReadonlySignal<T[]>, renderItem: (item: T, index: number, content: ContentDSL) => void, options?: ListOptions): void;
    form(key: string, builder: FormBuilder, options?: FormOptions): void;
    /**
     * Conditionally render a subtree based on a boolean condition.
     * When `condition` is a signal, the subtree is mounted/unmounted reactively as
     * the value flips. When true the `builder` subtree is shown; when false it is
     * removed (and its handlers/subscriptions torn down). An optional `elseBuilder`
     * renders while the condition is false. Compiles into the same reactive
     * reconciliation machinery as `listOf` — there is no separate render path.
     */
    when(condition: Bindable<boolean>, builder: ContainerBuilder, elseBuilder?: ContainerBuilder, options?: WhenOptions): void;
    /**
     * Render `builder`, but swap to `options.fallback` when the boundary enters an
     * error state. A boundary enters that state when (a) any observed `source`
     * signal (e.g. a `resource.error`) becomes non-null, or (b) the body builder
     * throws synchronously while building. The fallback receives the current error
     * and a `retry()` callback (which clears the local error, runs `onRetry`, and
     * re-attempts the body). Reuses the same reactive `when()` machinery, so its
     * subtree — and all handlers/subscriptions within it — are torn down on
     * removal. It does NOT trap arbitrary global errors; errors remain observable.
     */
    errorBoundary(id: string, builder: ContainerBuilder, options: ErrorBoundaryOptions): void;
    /**
     * Render the loading / error / success states of an async {@link Resource}
     * (§4). This is sugar over the existing `resource` state machine and `when()`
     * — NOT a second async system and NOT a literal port of React Suspense. It
     * renders exactly one branch at a time based on the resource's reactive state:
     * the `error` branch while `status === 'error'` (with a `retry()` that calls
     * `refetch`), otherwise the `success` branch once data is present (data passed
     * as a `ReadonlySignal<T>` so it updates in place, and stays visible while a
     * refetch is in flight), otherwise the `loading` branch. Because it is built
     * from `when()`, SSR renders whichever branch matches the resource's current
     * (peeked) state — so a server that awaits the resource before serializing
     * emits the resolved `success` branch, and hydration (seeded via the
     * resource's `initialData`) reuses it with no duplicate work. Resource
     * cleanup/cancellation is the resource's own concern (pass its `dispose` to
     * the owning scope's `onCleanup`, e.g. a component's `ctx.onCleanup`).
     */
    asyncBoundary<T>(key: string, resource: Resource<T>, branches: AsyncBoundaryBranches<T>): void;
    /**
     * Render `builder`'s subtree into `document.body` instead of inline at this
     * position (a neutral inline anchor is left behind). On the server there is no
     * body, so the content renders inline; hydration relocates it to a body
     * container to match the browser. Use for content that must escape overflow/
     * stacking contexts (overlays, toasts). Cleanup removes the body container.
     */
    portal(key: string, builder: ContainerBuilder, options?: PortalOptions): void;
    /**
     * Modal dialog: portal + `when(open, …)` panel with `role="dialog"`,
     * `aria-modal="true"`, focus trap + containment, Escape-to-close, and focus
     * restore on close. `builder` fills the dialog panel.
     */
    dialog(key: string, options: OverlayOptions, builder: ContainerBuilder): void;
    /**
     * Non-modal popover: portal + `when(open, …)` panel with `role="dialog"`.
     * Moves focus into the panel on open and restores it on close, but does not
     * trap or contain focus. Escape closes by default.
     */
    popover(key: string, options: OverlayOptions, builder: ContainerBuilder): void;
    /**
     * Tooltip: portal + `when(open, …)` panel with `role="tooltip"`. Non-modal
     * and does not steal focus (tooltips describe another element); no Escape
     * handling by default.
     */
    tooltip(key: string, options: OverlayOptions, builder: ContainerBuilder): void;
    /**
     * Dropdown menu: portal + `when(open, …)` panel with `role="menu"`. Non-modal;
     * moves focus into the menu on open, Escape closes, focus restored on close.
     */
    dropdown(key: string, options: OverlayOptions, builder: ContainerBuilder): void;
    /**
     * Toast: portal + `when(open, …)` panel with `role="status"` and
     * `aria-live="polite"`. Non-modal and never steals focus; no Escape handling.
     */
    toast(key: string, options: OverlayOptions, builder: ContainerBuilder): void;
    /**
     * Instantiate a reusable `component()` at this position (§3–§9). Creates a
     * `'component'` node (rendered as a `<div>` wrapper), runs the definition's
     * `setup(props, ctx)` synchronously to obtain its render function, and fills
     * the component's own container scope with it. Any `ctx.effect`/`ctx.onCleanup`
     * registered by the setup is torn down automatically when the component leaves
     * the graph. `props` are strongly typed by the definition's generic; pass
     * `Signal` props for fine-grained updates that do NOT re-run `setup` (§13).
     * The optional `children` builder is rendered wherever the component calls
     * `ctx.renderChildren` (§6 native child composition).
     */
    component<P>(key: string, def: ComponentDefinition<P>, props: P, children?: ContainerBuilder): void;
    /**
     * Declare document metadata (§1–§3): title, meta, link, canonical, Open Graph,
     * Twitter/X, robots, theme-color, favicon. Renders nothing visible at this
     * position (a neutral empty anchor); the framework applies the metadata to
     * `document.head` on the browser and emits it via `renderHead()` on the
     * server. Several `head()` calls compose — an app-level default, a route-level
     * `head()`, and a component-level `head()` are merged and, per metadata key,
     * the last declared (deepest/latest in document order) wins. Removing a
     * `head()` node (route change / component unmount) re-exposes the previously
     * shadowed value, and server tags are adopted on hydration without duplication.
     */
    head(metadata: HeadMetadata): void;
}
interface SectionDSL extends ContainerDSL {
}
interface FormDSL extends ContainerDSL {
}
interface ListDSL extends ContentDSL {
    item(key: string, builder: ContainerBuilder, options?: ContainerOptions): void;
}
interface PageDSL extends ContainerDSL {
}
interface AppDSL {
    page(key: string, builder: PageBuilder): void;
}

/**
 * DSL builder implementations.
 *
 * Each builder wraps a GraphNode and provides the fluent API
 * for constructing the Semantic Application Graph via the DSL.
 *
 * Builders do NOT render anything — they only build the graph.
 */

/**
 * A single reactive-list reconciliation descriptor (spec §15).
 *
 * Emitted by the `__listplan__<nodeId>` handler on every list change. `key` is
 * the item's identity-only reconciliation key (cheap to compute); `item` is the
 * source value *reference* used for identity short-circuiting; `sig()` computes
 * the content signature on demand (only when the reference changed); `build()`
 * materialises the full item subtree on demand (only for new/changed rows).
 */
interface ListPlanEntry {
    readonly key: string;
    readonly item: unknown;
    readonly sig: () => string;
    readonly build: () => GraphNode;
}
/** Content signature used to detect in-place data changes of a stable item. */
declare function reactiveListItemSignature(item: unknown): string;
/** Stable, identity-only reconciliation key for a reactive-list item. */
declare function reactiveListItemKey(item: unknown, index: number): string;
declare class ContentBuilderBase implements ContentDSL {
    protected readonly _node: GraphNode;
    protected readonly _graph: ApplicationGraph;
    constructor(_node: GraphNode, _graph: ApplicationGraph);
    heading(text: BindableText, options?: HeadingOptions): void;
    text(content: BindableText, options?: TextOptions): void;
    button(label: BindableText, options?: ButtonOptions): void;
    input(options?: InputOptions): void;
    image(options: ImageOptions): void;
    link(label: BindableText, options: LinkOptions): void;
}
declare class ContainerBuilderBase extends ContentBuilderBase implements ContainerDSL {
    section(key: string, builder: SectionBuilder, options?: SectionOptions): void;
    container(key: string, builder: ContainerBuilder, options?: ContainerOptions): void;
    list(key: string, builder: ListBuilder, options?: ListOptions): void;
    listOf<T>(key: string, items: Signal<T[]> | ReadonlySignal<T[]>, renderItem: (item: T, index: number, content: ContentDSL) => void, options?: ListOptions): void;
    form(key: string, builder: FormBuilder, options?: FormOptions): void;
    when(condition: Bindable<boolean>, builder: ContainerBuilder, elseBuilder?: ContainerBuilder, options?: WhenOptions): void;
    errorBoundary(id: string, builder: ContainerBuilder, options: ErrorBoundaryOptions): void;
    asyncBoundary<T>(key: string, res: Resource<T>, branches: AsyncBoundaryBranches<T>): void;
    portal(key: string, builder: ContainerBuilder, options?: PortalOptions): void;
    /**
     * Declare document metadata (2.0 §1–§3). Creates a `'head'` node — a neutral,
     * empty inline anchor at this position (one node / one element, so positional
     * hydration is preserved) — and registers a `__head__<id>` descriptor holding
     * this call's normalized, dedup-keyed {@link resolveHead} contribution. The
     * renderer applies it to `document.head` on the browser (adopting server tags
     * on hydration, cleaning up on unmount / route change) and emits the active
     * graph's merged metadata as a string on the server (`renderHead`).
     *
     * Multiple `head()` nodes may be live at once (app default + route + component)
     * — the renderer merges them and, per dedup key, the last in document order
     * wins (see head.ts). No new render path: this reuses the same graph-node +
     * handler-registry convention as overlays/transitions/components.
     */
    head(metadata: HeadMetadata): void;
    /**
     * Shared assembly for every overlay kind: a `portal` node whose single child
     * is a `when(open, panel)` conditional. The panel container carries the
     * kind's ARIA semantics; `builder` fills it. An `__overlay__<portalId>`
     * descriptor is registered so the renderer wires focus/keyboard behavior to
     * the same `open` signal that drives the panel. Reuses existing primitives
     * (portal + when + container) — no new render path.
     */
    private _overlay;
    dialog(key: string, options: OverlayOptions, builder: ContainerBuilder): void;
    popover(key: string, options: OverlayOptions, builder: ContainerBuilder): void;
    tooltip(key: string, options: OverlayOptions, builder: ContainerBuilder): void;
    dropdown(key: string, options: OverlayOptions, builder: ContainerBuilder): void;
    toast(key: string, options: OverlayOptions, builder: ContainerBuilder): void;
    /**
     * Instantiate a reusable component (§3–§9). Creates a `'component'` node
     * (rendered as a `<div>` wrapper — preserves the one-node/one-element
     * positional-hydration invariant), then runs `def.setup(props, ctx)`
     * synchronously to obtain the render function and fills the component's own
     * container scope with it — structurally identical to `container`/
     * `errorBoundary`. Cleanups the setup registers via `ctx.effect`/
     * `ctx.onCleanup` are collected into a closure and exposed to the renderer
     * through a `__component__<id>` handler (mirroring `__overlay__`); the mount/
     * hydrate paths read it and route each into `NodeInstance.trackCleanup`, so
     * teardown runs (children-first) when the component leaves the graph.
     *
     * `setup` runs once per instance here at build time. When this component sits
     * inside a keyed list / conditional, a rebuild disposes the old instance
     * (running its cleanups + pruning its `__component__` entry) and re-runs this
     * method for the new node — so re-invocation is safe and leak-free.
     */
    component<P>(key: string, def: ComponentDefinition<P>, props: P, children?: ContainerBuilder): void;
}
declare class SectionBuilderImpl extends ContainerBuilderBase implements SectionDSL {
}
declare class ContainerBuilderImpl extends ContainerBuilderBase implements ContainerDSL {
}
declare class FormBuilderImpl extends ContainerBuilderBase implements FormDSL {
}
declare class ListBuilderImpl extends ContentBuilderBase implements ListDSL {
    item(key: string, builder: ContainerBuilder, options?: ContainerOptions): void;
}
declare class PageBuilderImpl extends ContainerBuilderBase implements PageDSL {
}
declare class AppBuilder implements AppDSL {
    private readonly _graph;
    constructor(_graph: ApplicationGraph);
    page(key: string, builder: PageBuilder): void;
}

/**
 * StreetUI DSL entry point.
 *
 * Usage:
 *   import { streetui } from 'streetui';
 *
 *   const app = streetui.app({ name: 'My App' });
 *   app.page('home', page => {
 *     page.section('hero', section => {
 *       section.heading('Welcome');
 *       section.button('Click me', { onClick: () => {} });
 *     });
 *   });
 *
 *   const graph = app.build();
 */

interface AppOptions {
    readonly name: string;
    readonly version?: string;
}
declare class StreetApp {
    private readonly _graph;
    private readonly _builder;
    constructor(options: AppOptions);
    page(key: string, builder: Parameters<AppBuilder['page']>[1]): this;
    /** Compile to ApplicationGraph — validates and returns the graph. */
    build(): ApplicationGraph;
    /** Access graph before building (useful for inspection). */
    get graph(): ApplicationGraph;
}
interface StreetUI {
    app(options: AppOptions): StreetApp;
}
declare const streetui: StreetUI;

/**
 * StreetUI compiler entry point.
 *
 * Pipeline:
 *   StreetApp (DSL)
 *     → ApplicationGraph (build)
 *     → validate
 *     → transform
 *     → CompiledApplication
 */

interface CompiledApplication {
    /** The fully built, validated, and transformed graph. */
    readonly graph: ApplicationGraph;
    /** Diagnostics accumulated during compilation. */
    readonly diagnostics: DiagnosticCollector;
    /** Metadata */
    readonly name: string;
    readonly version: string;
    readonly compiledAt: number;
}
interface CompileOptions {
    /** If true, compilation throws on errors. Defaults to true. */
    readonly strict?: boolean;
    /** If true, also throw on warnings. Defaults to false. */
    readonly strictWarnings?: boolean;
}
/**
 * Compile a StreetApp DSL definition into a CompiledApplication
 * ready for the runtime to execute.
 */
declare function compile(app: StreetApp, options?: CompileOptions): CompiledApplication;
/**
 * Compile from a pre-built ApplicationGraph (used when the graph
 * was constructed programmatically rather than through the DSL).
 */
declare function compileGraph(graph: ApplicationGraph, options?: CompileOptions): CompiledApplication;

/**
 * Hydration diagnostics — dev-only, opt-in explanations of hydration mismatches.
 *
 * Hydration is self-repairing: when the server-rendered DOM does not match the
 * graph at a position, the renderer mounts a fresh subtree in place and drops
 * the offending element (see `hydrateChildren` in `hydrate.ts`). That recovery
 * is silent by design — a local mismatch must never tear down the whole app.
 *
 * During development, though, a silent repair hides a real problem (usually a
 * server/client divergence). A `HydrationDiagnosticSink` can be attached to the
 * renderer to *observe* those repairs without changing them: for every mismatch
 * the renderer reports what it expected, what it found, where, and what it did
 * to recover. Nothing is thrown, nothing is mutated differently, and when no
 * sink is attached there is zero additional work on the hydration path.
 */
/** What kind of divergence the hydrator encountered at a position. */
type HydrationMismatchType = 'tag-mismatch' | 'missing-element' | 'surplus-element';
/** A single, fully-described hydration divergence and the repair taken. */
interface HydrationDiagnostic {
    /** The category of mismatch. */
    readonly type: HydrationMismatchType;
    /** The tag the graph expected at this position (null for a surplus element). */
    readonly expected: string | null;
    /** The tag actually found in the server DOM (null for a missing element). */
    readonly found: string | null;
    /** A human-readable path to the position, e.g. `app / page[0] / section[1]`. */
    readonly path: string;
    /** The graph node id involved, when one exists (null for surplus DOM). */
    readonly nodeId: string | null;
    /** The semantic node type involved, when one exists (null for surplus DOM). */
    readonly nodeType: string | null;
    /** The recovery action the renderer performed. */
    readonly action: string;
    /** A single-line, developer-facing summary of the whole diagnostic. */
    readonly message: string;
}
/**
 * Receives hydration diagnostics as they are discovered. Kept intentionally
 * tiny so any logger — `console`, a test collector, a `DiagnosticSink` — can
 * satisfy it. Implementations must not throw.
 */
interface HydrationDiagnosticSink {
    report(diagnostic: HydrationDiagnostic): void;
}
/** Build the canonical one-line message for a diagnostic. */
declare function formatHydrationDiagnostic(d: Omit<HydrationDiagnostic, 'message'>): string;
/**
 * A ready-made sink that accumulates diagnostics into an array — the shape most
 * useful for tests and for a DevTools panel. The returned `diagnostics` array is
 * appended to in-place as repairs happen.
 */
declare function createHydrationDiagnosticCollector(): {
    readonly sink: HydrationDiagnosticSink;
    readonly diagnostics: HydrationDiagnostic[];
};
/**
 * A sink that forwards each diagnostic to a `console`-like logger as a single
 * warning line. Handy default when you just want the messages surfaced in dev.
 */
declare function consoleHydrationDiagnosticSink(logger?: {
    warn(message: string): void;
}): HydrationDiagnosticSink;

export { type FormBuilder as $, type ApplicationId as A, BaseNode as B, type CompiledApplication as C, DiagnosticCollector as D, type ComponentRender as E, type ComponentSetup as F, GraphNode as G, type HydrationDiagnostic as H, ContainerBuilderImpl as I, type ContainerOptions as J, type ContentDSL as K, type ControlledInputOptions as L, DerivedSignal as M, type Diagnostic as N, DiagnosticError as O, type PageDSL as P, type DiagnosticLocation as Q, type ReadonlySignal as R, StreetApp as S, type TransitionConfig as T, type Unsubscribe as U, VERSION as V, type DiagnosticSeverity as W, type ErrorBoundaryOptions as X, type ErrorFallbackBuilder as Y, type ErrorSource as Z, type EventDescriptor as _, type ComponentDefinition as a, observerCount as a$, FormBuilderImpl as a0, type FormDSL as a1, type FormOptions as a2, type GraphNodeData as a3, type HandlerFn as a4, type HeadContribution as a5, type HeadEntry as a6, type HeadMetadata as a7, type HeadingOptions as a8, type HydrationMismatchType as a9, type SectionOptions as aA, type SerializedGraph as aB, type SerializedNode as aC, type StateRef as aD, type StreetUI as aE, type TextOptions as aF, type TextValue as aG, type WhenOptions as aH, batch as aI, compile as aJ, compileGraph as aK, component as aL, consoleHydrationDiagnosticSink as aM, createHydrationDiagnosticCollector as aN, createNodeId as aO, derived as aP, effect as aQ, formatDiagnostic as aR, formatHydrationDiagnostic as aS, generateApplicationId as aT, generateNodeId as aU, isBatching as aV, isComponentDefinition as aW, isHeadContribution as aX, isTransitionConfig as aY, nextId as aZ, nodeIdPrefix as a_, type ImageOptions as aa, type InputOptions as ab, type InputOptionsBase as ac, type LinkDescriptor as ad, type LinkOptions as ae, type ListBuilder as af, ListBuilderImpl as ag, type ListDSL as ah, type ListOptions as ai, type ListPlanEntry as aj, type MetaDescriptor as ak, type NodeId as al, type NodeMetadata as am, type OverlayOptions as an, type PageBuilder as ao, PageBuilderImpl as ap, type PortalOptions as aq, type PropValue as ar, type Props as as, type ReactiveConsumer as at, type ReactiveSource as au, type ResolvedTransition as av, type ResourceLoader as aw, type SectionBuilder as ax, SectionBuilderImpl as ay, type SectionDSL as az, type ContainerBuilder as b, reactiveListItemKey as b0, reactiveListItemSignature as b1, resetIdCounter as b2, resolveHead as b3, resolveTransition as b4, resource as b5, signal as b6, signalKind as b7, streetui as b8, Signal as c, type Subscriber as d, type ResourceStatus as e, type ResourceOptions as f, type Resource as g, type ResourceLoaderContext as h, ApplicationGraph as i, type HydrationDiagnosticSink as j, type SemanticNodeType as k, type ContainerDSL as l, type SignalKind as m, type A11yOptions as n, AppBuilder as o, type AppDSL as p, type AppOptions as q, type ApplicationGraphOptions as r, type AsyncBoundaryBranches as s, type Bindable as t, type BindableString as u, type BindableText as v, type BoundInputOptions as w, type ButtonOptions as x, type CompileOptions as y, type ComponentContext as z };
