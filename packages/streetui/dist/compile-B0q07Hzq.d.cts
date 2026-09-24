/**
 * The single authoritative StreetUI framework version.
 *
 * This constant is the one source of truth for the version of the shipped
 * `streetui` package. It is kept in lock-step with this package's
 * `package.json` `version` field and with the bundled CLI's reported version
 * (`streetui --version`) — the consolidated test-suite pins all three to the
 * same coordinated release so they can never silently drift apart.
 */
declare const VERSION = "1.0.0";

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

type SemanticNodeType = 'application' | 'page' | 'section' | 'container' | 'heading' | 'text' | 'button' | 'input' | 'form' | 'list' | 'list-item' | 'image' | 'link' | 'component' | 'slot' | 'fragment' | 'reactive-list' | 'conditional';
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
}
interface SectionOptions extends ContainerOptions {
}
interface FormOptions extends ContainerOptions {
    readonly onSubmit?: (e: Event) => void;
}
interface ListOptions extends ContainerOptions {
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
    when(condition: Bindable<boolean>, builder: ContainerBuilder, elseBuilder?: ContainerBuilder): void;
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
    when(condition: Bindable<boolean>, builder: ContainerBuilder, elseBuilder?: ContainerBuilder): void;
    errorBoundary(id: string, builder: ContainerBuilder, options: ErrorBoundaryOptions): void;
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

export { type ListDSL as $, type ApplicationId as A, BaseNode as B, type CompiledApplication as C, DiagnosticCollector as D, type ErrorBoundaryOptions as E, type ErrorFallbackBuilder as F, GraphNode as G, type ErrorSource as H, type EventDescriptor as I, type FormBuilder as J, FormBuilderImpl as K, type FormDSL as L, type FormOptions as M, type GraphNodeData as N, type HandlerFn as O, type PageDSL as P, type HeadingOptions as Q, type ReadonlySignal as R, StreetApp as S, type ImageOptions as T, type Unsubscribe as U, VERSION as V, type InputOptions as W, type InputOptionsBase as X, type LinkOptions as Y, type ListBuilder as Z, ListBuilderImpl as _, Signal as a, type ListOptions as a0, type NodeId as a1, type NodeMetadata as a2, type PageBuilder as a3, PageBuilderImpl as a4, type PropValue as a5, type Props as a6, type ReactiveConsumer as a7, type ReactiveSource as a8, type SectionBuilder as a9, signalKind as aA, streetui as aB, SectionBuilderImpl as aa, type SectionDSL as ab, type SectionOptions as ac, type SerializedGraph as ad, type SerializedNode as ae, type StateRef as af, type StreetUI as ag, type TextOptions as ah, type TextValue as ai, batch as aj, compile as ak, compileGraph as al, createNodeId as am, derived as an, effect as ao, formatDiagnostic as ap, generateApplicationId as aq, generateNodeId as ar, isBatching as as, nextId as at, nodeIdPrefix as au, observerCount as av, reactiveListItemKey as aw, reactiveListItemSignature as ax, resetIdCounter as ay, signal as az, type Subscriber as b, ApplicationGraph as c, type SemanticNodeType as d, type ContainerDSL as e, type SignalKind as f, type A11yOptions as g, AppBuilder as h, type AppDSL as i, type AppOptions as j, type ApplicationGraphOptions as k, type Bindable as l, type BindableText as m, type BoundInputOptions as n, type ButtonOptions as o, type CompileOptions as p, type ContainerBuilder as q, ContainerBuilderImpl as r, type ContainerOptions as s, type ContentDSL as t, type ControlledInputOptions as u, DerivedSignal as v, type Diagnostic as w, DiagnosticError as x, type DiagnosticLocation as y, type DiagnosticSeverity as z };
