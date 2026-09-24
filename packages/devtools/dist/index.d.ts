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

export { type ApplicationIdentity, type ApplicationInspection, type ApplicationPanel, type ContextInspection, type ContextLike, DEFAULT_PERF_THRESHOLDS, type DevToolsOptions, type DevToolsSession, type DevToolsSnapshot, type DevToolsSources, type DiagnosticsSummary, type FormInspection, type FormLike, type I18nInspection, type I18nLike, type InspectFormOptions, type InspectI18nOptions, type InspectResourceOptions, type InspectSignalOptions, type InspectedNode, type InspectedPage, type PerfDiagnostic, type PerfDiagnosticCode, type PerfSnapshot, type PerfThresholds, type PerformancePanel, type ResourceInspection, type ResourceLike, type RouteMatchLike, type RouterInspection, type RouterLike, type SignalInspection, type SignalsPanel, createDevTools, diagnosePerformance, inspectApplication, inspectContext, inspectForm, inspectGraph, inspectI18n, inspectResource, inspectRouter, inspectSignal, nodeTypeStats, printDiagnostics, printGraph };
