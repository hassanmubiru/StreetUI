import { G as GraphNode, R as ReadonlySignal, C as CompiledApplication, i as ApplicationGraph, j as HydrationDiagnosticSink } from './hydration-diagnostics-CFYDXBlm.cjs';

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
 * DOMAdapter — framework-owned abstraction over DOM operations.
 *
 * The renderer depends on this interface, never on raw browser globals,
 * which makes the renderer testable and portable.
 */
interface DOMAdapter {
    createElement(tag: string, ns?: string): Element;
    createTextNode(data: string): Text;
    createComment(data: string): Comment;
    createFragment(): DocumentFragment;
    /**
     * Optional, server-only: create a verbatim pre-serialized HTML node used by
     * the v1.7 static SSR plan. The browser adapter does not implement it; the
     * renderer only calls it when a static SSR plan is active (i.e. during SSR),
     * so client builds never reach this path and it stays tree-shakeable.
     */
    createRawHTML?(html: string): Node;
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
    /**
     * Move focus to an element. On the server (or when the element cannot receive
     * focus) this is a safe no-op, keeping focus management SSR-compatible.
     */
    focus(element: Element): void;
    /**
     * The document body — the default mount target for portals/overlays. Returns
     * null on the server (no document), which is what makes portal SSR degrade to
     * inline rendering and focus management degrade to a no-op.
     */
    body(): Element | null;
    /**
     * The document head — the mount target for `head()` metadata (title/meta/
     * link/etc.). Returns null on the server (no document), which is what makes
     * the head platform degrade to server-side string emission (`renderHead`) and
     * the browser `wireHeadBehavior` a no-op on the server render pass.
     */
    head(): Element | null;
    /** The currently focused element, or null on the server / when none is focused. */
    activeElement(): Element | null;
    /** True if `ancestor` contains `node` (inclusive). Always false on the server. */
    contains(ancestor: Element, node: Node): boolean;
    /** True if `element` matches the given CSS selector. Always false on the server. */
    matches(element: Element, selector: string): boolean;
    isElement(node: Node): node is Element;
    isTextNode(node: Node): node is Text;
    /** Lower-cased tag name of an element (e.g. "div", "h1"). */
    tagName(element: Element): string;
    parentNode(node: Node): Node | null;
    nextSibling(node: Node): Node | null;
    /** First child node (element, text, or otherwise), or null. */
    firstChild(node: Node): Node | null;
    /** All child nodes of an element in order (empty for leaf/text nodes). */
    childNodes(node: Node): Node[];
}

/**
 * Server implementation of `DOMAdapter`.
 *
 * Builds a lightweight in-memory tree (see `server-node.ts`) instead of touching
 * a real browser DOM, then lets the caller serialize it to an HTML string. It is
 * completely free of browser globals, so the exact same renderer that runs in
 * the browser can produce HTML on the server.
 *
 * The `DOMAdapter` interface is typed against the lib DOM types (`Element`,
 * `Node`, `Text`, …). Our server nodes structurally stand in for those at
 * runtime, so the boundary uses `as unknown as` casts in one place. Everything
 * inside operates on the real server-node model.
 */

declare class ServerDOMAdapter implements DOMAdapter {
    createElement(tag: string, _ns?: string): Element;
    createTextNode(data: string): Text;
    createComment(data: string): Comment;
    createFragment(): DocumentFragment;
    /**
     * Create a verbatim pre-serialized HTML node (v1.7 static SSR plan, §6).
     * Server-only: the browser adapter does not implement this, and the renderer
     * fast path only invokes it when a static SSR plan is present (SSR). The
     * stored HTML was produced by this same serializer, so it is emitted as-is.
     */
    createRawHTML(html: string): Node;
    appendChild(parent: Node, child: Node): void;
    insertBefore(parent: Node, child: Node, reference: Node | null): void;
    removeChild(parent: Node, child: Node): void;
    replaceChild(parent: Node, newChild: Node, oldChild: Node): void;
    private _detach;
    setAttribute(element: Element, name: string, value: string): void;
    removeAttribute(element: Element, name: string): void;
    getAttribute(element: Element, name: string): string | null;
    setProperty(element: Element, name: string, value: unknown): void;
    setTextContent(node: Node, text: string): void;
    getTextContent(node: Node): string | null;
    addEventListener(): void;
    removeEventListener(): void;
    querySelector(): Element | null;
    querySelectorAll(): NodeListOf<Element>;
    getElementById(): Element | null;
    focus(): void;
    body(): Element | null;
    head(): Element | null;
    activeElement(): Element | null;
    contains(_ancestor: Element, _node: Node): boolean;
    matches(_element: Element, _selector: string): boolean;
    isElement(node: Node): node is Element;
    isTextNode(node: Node): node is Text;
    tagName(element: Element): string;
    parentNode(node: Node): Node | null;
    nextSibling(node: Node): Node | null;
    firstChild(node: Node): Node | null;
    childNodes(node: Node): Node[];
    /** Serialize a node's children ("inner HTML") to an HTML string. */
    serializeInner(node: Node): string;
    /** Serialize a node (including itself) to an HTML string. */
    serializeOuter(node: Node): string;
}
declare const serverDOMAdapter: ServerDOMAdapter;

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
 * Document head / metadata runtime (2.0 §1–§3).
 *
 * Two entry points, sharing the normalized {@link HeadEntry} model the DSL's
 * `head()` produces (mirrored here as a local structural type so the renderer
 * takes no compile-time dependency on the DSL package — the same convention as
 * the overlay/component descriptors):
 *
 *   • `wireHeadBehavior(ctx, node, instance)` — BROWSER. Reads the
 *     `__head__<id>` descriptor, registers this node's contribution with a
 *     per-render {@link HeadManager} (created lazily on `ctx`), subscribes to any
 *     reactive attr/text signals, and tracks cleanup on the NodeInstance so the
 *     contribution is withdrawn (and the manager re-applies the merged result)
 *     when the node unmounts or the route changes. Server-safe: when
 *     `dom.head()` is null (SSR) it is a no-op.
 *
 *   • `renderHead(compiled)` — SERVER. Walks the compiled graph in document
 *     order, merges every live `head()` contribution (last-in-document-order
 *     wins per dedup key — §3), and serializes the effective tags to an HTML
 *     string for the caller to place inside `<head>`. Only the active graph is
 *     walked, so only active-route metadata is emitted (§2). Each tag carries
 *     `data-streetui-head` + `data-streetui-head-key="…"` so the browser adopts
 *     it on hydration instead of creating a duplicate.
 */

interface HeadEntryLike {
    readonly tag: 'title' | 'meta' | 'link' | 'base';
    readonly dedupKey: string;
    readonly attrs: Readonly<Record<string, unknown>>;
    readonly text?: unknown;
}
/**
 * Coordinates every live `head()` node's contribution into a single
 * `document.head`. One instance per render (lazily created on `ctx`). Merges by
 * dedup key with last-in-document-order winning, and applies the minimal diff to
 * the DOM on every register/unregister/signal change. Adopts server-emitted tags
 * on the first apply so hydration produces no duplicates.
 */
declare class HeadManager {
    private readonly _dom;
    private readonly _head;
    private readonly _contributions;
    private readonly _applied;
    private _order;
    private _adopted;
    constructor(dom: DOMAdapter, head: Element);
    /** Register (or replace) a node's contribution and re-apply the merged result. */
    register(nodeId: string, entries: readonly HeadEntryLike[]): void;
    /** Withdraw a node's contribution (unmount / route change) and re-apply. */
    unregister(nodeId: string): void;
    /** Recompute the merged head and patch `document.head` to match. */
    apply(): void;
    private _createTag;
    private _reconcileAttrs;
    /**
     * Seed `_applied` from server-emitted `[data-streetui-head-key]` tags already
     * in `document.head`. The subsequent diff reuses these elements when the
     * client desires the same key (no duplicate), rewrites them if the value
     * changed, or removes them if the client graph no longer wants them.
     */
    private _adoptServerTags;
    /** The framework-managed attribute names currently on a server tag. */
    private _attrNames;
}
/**
 * Wire a mounted/hydrated `head` node's contribution into `document.head`.
 * Server-safe (no-op when there is no document). Shared by the mount and hydrate
 * paths so both establish identical ownership + cleanup.
 */
declare function wireHeadBehavior(ctx: RenderContext, graphNode: GraphNode, instance: NodeInstance): void;
/**
 * Render the active graph's merged document metadata to an HTML string suitable
 * for placing inside `<head>`. Walks the graph in document order, merges every
 * `head()` contribution (last-in-document-order wins per dedup key), and
 * serializes each effective tag with the `data-streetui-head` marker so the
 * browser adopts it on hydration. Returns `''` when the app declares no metadata
 * — so apps that never call `head()` emit nothing extra and existing SSR output
 * is unchanged.
 */
declare function renderHead(compiled: CompiledApplication): string;

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
    /**
     * Optional SSR-only static-subtree plan (v1.7). Maps a maximal
     * static-subtree root GraphNode.id → its precomputed, verbatim HTML string.
     * Present only on the server render path when a plan has been built; on the
     * browser mount path it is always `undefined`, so the client hot path is
     * unaffected (a single `=== undefined` check short-circuits). When a mounted
     * node's id is in this map, the renderer emits the precomputed HTML via
     * `dom.createRawHTML` instead of recursively constructing the subtree.
     */
    readonly staticHTML?: ReadonlyMap<string, string>;
    /**
     * Lazily-created coordinator for `head()` metadata nodes (2.0 §1). Created on
     * first `wireHeadBehavior` call on the browser (never on the server, where
     * `dom.head()` is null and `renderHead` emits the metadata instead). Mutable
     * because it is attached on demand; a render with no `head()` nodes never
     * allocates one.
     */
    head?: HeadManager;
}
declare function createRenderContext(dom: DOMAdapter, graph: ApplicationGraph, container: Element, hydrationDiagnostics?: HydrationDiagnosticSink, staticHTML?: ReadonlyMap<string, string>): RenderContext;

/**
 * SSR state transfer (dehydration) — move server-resolved data to the client.
 *
 * When the server resolves resources before rendering, their data must reach
 * the client so hydration can seed them (via `resource({ initialData })`)
 * instead of refetching. StreetUI does this with a single, framework-scoped
 * `<script>` payload rather than blindly interpolating `JSON.stringify` into
 * markup.
 *
 * Safety (v0.4 rule #16): the JSON is emitted into a
 * `<script type="application/json">` block — an inert data island the browser
 * never executes — and every character that could terminate that block or be
 * reinterpreted by the HTML/JS parser is escaped to its `\uXXXX` form. Because
 * `<` inside JSON parses back to `<`, the payload round-trips exactly
 * while being impossible to break out of. This is deterministic (stable key
 * order is the caller's responsibility) and typed at the boundary as
 * `Record<string, unknown>` — never `any`.
 */

/** Attribute marking StreetUI's state island so the client can find it. */
declare const STATE_MARKER_ATTR = "data-streetui-state";
/**
 * Serialize a state map to an HTML `<script>` island for inclusion in the
 * server-rendered document (typically just before the closing tag of the
 * mount container). Returns an empty string for an empty map.
 */
declare function serializeState(state: Record<string, unknown>): string;
/**
 * Read the state island back on the client. Searches `root` for StreetUI's
 * state `<script>` and parses it. Returns an empty object when absent or
 * unparseable (hydration then proceeds as a cold client render). Routed through
 * the DOM adapter so it is testable and never assumes a global `document`.
 */
declare function readState(dom: DOMAdapter, root: Element | Document): Record<string, unknown>;

/**
 * Server-side rendering — `renderToString`.
 *
 * Runs the *exact same* mount pipeline used in the browser (`mountGraph`), but
 * against a `ServerDOMAdapter` that builds a lightweight in-memory node tree
 * instead of a real browser DOM. The tree is then serialized to a normal HTML
 * string. Because both browser and server share the DSL → Compiler → Graph →
 * Runtime → Renderer pipeline, there is no second, SSR-specific renderer and no
 * virtual DOM.
 *
 * Lifecycle (v0.4 rule #20): the initial synchronous mount may open signal
 * subscriptions (via `wireSignalBindings`/`wireReactiveList`). On the server
 * those would be live forever, so once the HTML is serialized we dispose the
 * root instance — tearing down every subscription and listener. SSR therefore
 * has a *render* lifecycle only; the live *runtime* lifecycle is established
 * later on the client by `hydrate`.
 */

interface RenderToStringOptions {
    /**
     * Override the server DOM adapter (rarely needed). Defaults to a fresh
     * `ServerDOMAdapter` per call so concurrent renders never share state.
     */
    readonly domAdapter?: ServerDOMAdapter;
    /**
     * @internal — testing/benchmark knob for the v1.7 static SSR plan.
     *
     * `undefined` (default): use the per-app cached plan (build once, reuse).
     * `null`: disable the plan entirely — the exact v1.6 runtime mount path, used
     *   by the byte-identity gate and A/B benchmark as the "legacy" baseline.
     * a map: use this explicit plan.
     *
     * Not part of the supported public API; output is byte-identical regardless
     * of this value (§8).
     */
    readonly staticPlan?: ReadonlyMap<string, string> | null;
}
/**
 * Render a compiled StreetUI application to an HTML string.
 *
 * The returned markup contains only the application's own elements (the
 * synthetic container is not emitted), so callers embed it wherever they mount
 * on the client — e.g. inside `<div id="app">…</div>`.
 */
declare function renderToString(compiled: CompiledApplication, options?: RenderToStringOptions): string;

export { CleanupRegistry as C, type DOMAdapter as D, HeadManager as H, Lifecycle as L, NodeInstance as N, type RenderContext as R, STATE_MARKER_ATTR as S, type LifecycleHook as a, type LifecyclePhase as b, type RenderToStringOptions as c, ServerDOMAdapter as d, createRenderContext as e, renderHead as f, renderToString as g, serverDOMAdapter as h, readState as r, serializeState as s, wireHeadBehavior as w };
