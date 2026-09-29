import { ApplicationGraph } from '@streetui/graph';
import { CompiledApplication } from '@streetui/compiler';
import { SignalKind, ResourceStatus, ReadonlySignal } from '@streetui/state';

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
 * separate `reportError`/`DiagnosticSink` seam in `@streetui/core` (§7).
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

export { type ApplicationIdentity, type ApplicationInspection, type ApplicationPanel, type ContextInspection, type ContextLike, DEFAULT_PERF_THRESHOLDS, DEVTOOLS_TABS, type DevToolsOptions, type DevToolsSession, type DevToolsSnapshot, type DevToolsSources, type DiagnosticsPanel, type DiagnosticsSummary, type EventInspection, type FormInspection, type FormLike, type HydrationInspection, type I18nInspection, type I18nLike, type InspectFormOptions, type InspectI18nOptions, type InspectResourceOptions, type InspectSignalGraphOptions, type InspectSignalOptions, type InspectedComponent, type InspectedEventNode, type InspectedInteractions, type InspectedNode, type InspectedOverlay, type InspectedPage, type InspectedTransition, type InteractiveDevToolsOptions, type MutationInspection, type MutationLike, type PerfDiagnostic, type PerfDiagnosticCode, type PerfSnapshot, type PerfThresholds, type PerformancePanel, type ResourceInspection, type ResourceLike, type RouteMatchLike, type RouterInspection, type RouterLike, type SignalGraph, type SignalGraphEdge, type SignalGraphNode, type SignalInspection, type SignalsPanel, createDevTools, diagnosePerformance, escapeHtml, inspectApplication, inspectComponents, inspectContext, inspectEvents, inspectForm, inspectGraph, inspectHydration, inspectI18n, inspectInteractions, inspectMutation, inspectResource, inspectRouter, inspectSignal, inspectSignalGraph, nodeTypeStats, printDiagnostics, printGraph, renderDevToolsHTML, renderDevToolsReport, renderInteractiveDevTools };
