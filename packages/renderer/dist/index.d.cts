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
}
declare function createRenderContext(dom: DOMAdapter, graph: ApplicationGraph, container: Element, hydrationDiagnostics?: HydrationDiagnosticSink, staticHTML?: ReadonlyMap<string, string>): RenderContext;

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
 * `__transition__<id>`. Mirrors `@streetui/dsl`'s `ResolvedTransition` without
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

/**
 * Maps semantic node types to HTML tag names.
 */

declare function resolveTag(type: SemanticNodeType): string;

export { type HydrationDiagnostic, type HydrationDiagnosticSink, type HydrationMismatchType, type MountFn, NodeInstance, type PlanEntry, type ReconcileResult, type RenderContext, type RenderToStringOptions, type ResolvedTransitionLike, STATE_MARKER_ATTR, StreetRenderHandle, StreetRendererImpl, type StreetRendererOptions, TransitionController, type TransitionHooks, type TransitionPhase, applyNodeProps, applyProp, buttonUpdate, consoleHydrationDiagnosticSink, createHydrationDiagnosticCollector, createRenderContext, createRenderer, formatHydrationDiagnostic, getResolvedTransition, headingUpdate, hydrateGraph, inputUpdate, mountGraph, mountNode, patchNode, patchProp, readState, reconcileChildren, reconcileChildrenByPlan, renderToString, resolveTag, runElementTransition, serializeState, textUpdate, wireComponentBehavior, wireEvents, wireOverlayBehavior, wireReactiveList, wireSignalBindings };
