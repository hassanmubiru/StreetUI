import { DOMAdapter, ServerDOMAdapter } from '@streetui/dom';
import { GraphNode, ApplicationGraph } from '@streetui/graph';
import { CleanupRegistry, SemanticNodeType } from '@streetui/core';
import { ReadonlySignal } from '@streetui/state';
import { CompiledApplication } from '@streetui/compiler';
import { StreetRenderer, RenderHandle } from '@streetui/runtime';

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
 * DSL-registered build factory produces the desired child graph nodes, which
 * are reconciled against the live DOM with the keyed reconciler.
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
}
/**
 * Render a compiled StreetUI application to an HTML string.
 *
 * The returned markup contains only the application's own elements (the
 * synthetic container is not emitted), so callers embed it wherever they mount
 * on the client — e.g. inside `<div id="app">…</div>`.
 */
declare function renderToString(compiled: CompiledApplication, options?: RenderToStringOptions): string;

/**
 * Maps semantic node types to HTML tag names.
 */

declare function resolveTag(type: SemanticNodeType): string;

export { type HydrationDiagnostic, type HydrationDiagnosticSink, type HydrationMismatchType, type MountFn, NodeInstance, type ReconcileResult, type RenderContext, type RenderToStringOptions, STATE_MARKER_ATTR, StreetRenderHandle, StreetRendererImpl, type StreetRendererOptions, applyNodeProps, applyProp, buttonUpdate, consoleHydrationDiagnosticSink, createHydrationDiagnosticCollector, createRenderContext, createRenderer, formatHydrationDiagnostic, headingUpdate, hydrateGraph, inputUpdate, mountGraph, mountNode, patchNode, patchProp, readState, reconcileChildren, renderToString, resolveTag, serializeState, textUpdate, wireEvents, wireReactiveList, wireSignalBindings };
