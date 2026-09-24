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
    /** The package that produced the diagnostic, e.g. `@streetui/renderer`. */
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

export { type A11yIds, Application, type ApplicationId, type ApplicationOptions, BaseNode, CleanupRegistry, type Diagnostic, DiagnosticCollector, type DiagnosticContext, DiagnosticError, type DiagnosticLocation, type DiagnosticSeverity, type DiagnosticSink, Environment, type EnvironmentCapabilities, type EnvironmentKind, Lifecycle, type LifecycleHook, type LifecyclePhase, type NodeId, type NodeMetadata, type SemanticNodeType, StreetFrameworkError, a11yIds, consoleDiagnosticSink, createApplication, createNodeId, environment, formatDiagnostic, formatDiagnosticContext, frameworkError, generateApplicationId, generateNodeId, nextId, nodeIdPrefix, reportDiagnostic, resetIdCounter, toIdToken };
