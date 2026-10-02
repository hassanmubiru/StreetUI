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

type SemanticNodeType = 'application' | 'page' | 'section' | 'container' | 'heading' | 'text' | 'button' | 'input' | 'form' | 'list' | 'list-item' | 'image' | 'link' | 'code' | 'component' | 'slot' | 'fragment' | 'reactive-list' | 'conditional' | 'portal' | 'head';
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
 * StreetUI styling — canonical style model + stable identity.
 *
 * A *style* is pure, serializable data describing appearance (§1 Q1). This module
 * defines the authoring type model and the compile-time canonicalization that
 * turns any `StyleDef` into (a) a deterministic, order-independent canonical form
 * and (b) a stable class identity `s-<hash>`. Identical styles → identical
 * canonical form → identical identity → one shared CSS rule (§18 dedup).
 *
 * This file is pure and DOM-free: it never touches the graph, a signal, or the
 * renderer. It is the foundation the registry (`registry.ts`), CSS generator
 * (`css.ts`) and authoring API (`style.ts`) build on.
 */
/** A raw CSS value: a string (`'1px solid'`) or a number (lengths → px). */
type CSSValue = string | number;
/** The responsive breakpoint keys, smallest → largest. `base` is unconditional. */
type Breakpoint = 'base' | 'sm' | 'md' | 'lg' | 'xl';
/** A value that may vary by breakpoint. A bare value means "all breakpoints". */
type ResponsiveValue<T> = T | Partial<Record<Breakpoint, T>>;
/** Native CSS pseudo-states the browser owns (styled via CSS, never JS). */
type PseudoState = 'hover' | 'focus' | 'focusVisible' | 'focusWithin' | 'active' | 'disabled' | 'checked' | 'firstChild' | 'lastChild';
/** Reactive component/application states (distinct from native pseudo states). */
type ComponentState = 'open' | 'closed' | 'active' | 'selected' | 'expanded' | 'collapsed' | 'loading' | 'error' | 'disabled' | 'invalid' | 'busy' | 'current';
/**
 * A set of CSS declarations. Keys are camelCase CSS property names; values may be
 * responsive. The curated property surface gives autocomplete and rejects unknown
 * keys under strict object-literal checking (§23) without pulling an external
 * `csstype` dependency. Unlisted-but-valid CSS can still be set via the inline
 * `style` prop escape hatch on an element (precedence §5).
 */
interface StyleProperties {
    readonly display?: ResponsiveValue<CSSValue>;
    readonly position?: ResponsiveValue<CSSValue>;
    readonly inset?: ResponsiveValue<CSSValue>;
    readonly top?: ResponsiveValue<CSSValue>;
    readonly right?: ResponsiveValue<CSSValue>;
    readonly bottom?: ResponsiveValue<CSSValue>;
    readonly left?: ResponsiveValue<CSSValue>;
    readonly zIndex?: ResponsiveValue<CSSValue>;
    readonly width?: ResponsiveValue<CSSValue>;
    readonly minWidth?: ResponsiveValue<CSSValue>;
    readonly maxWidth?: ResponsiveValue<CSSValue>;
    readonly height?: ResponsiveValue<CSSValue>;
    readonly minHeight?: ResponsiveValue<CSSValue>;
    readonly maxHeight?: ResponsiveValue<CSSValue>;
    readonly margin?: ResponsiveValue<CSSValue>;
    readonly marginTop?: ResponsiveValue<CSSValue>;
    readonly marginRight?: ResponsiveValue<CSSValue>;
    readonly marginBottom?: ResponsiveValue<CSSValue>;
    readonly marginLeft?: ResponsiveValue<CSSValue>;
    readonly padding?: ResponsiveValue<CSSValue>;
    readonly paddingTop?: ResponsiveValue<CSSValue>;
    readonly paddingRight?: ResponsiveValue<CSSValue>;
    readonly paddingBottom?: ResponsiveValue<CSSValue>;
    readonly paddingLeft?: ResponsiveValue<CSSValue>;
    readonly gap?: ResponsiveValue<CSSValue>;
    readonly rowGap?: ResponsiveValue<CSSValue>;
    readonly columnGap?: ResponsiveValue<CSSValue>;
    readonly flex?: ResponsiveValue<CSSValue>;
    readonly flexDirection?: ResponsiveValue<CSSValue>;
    readonly flexWrap?: ResponsiveValue<CSSValue>;
    readonly flexGrow?: ResponsiveValue<CSSValue>;
    readonly flexShrink?: ResponsiveValue<CSSValue>;
    readonly flexBasis?: ResponsiveValue<CSSValue>;
    readonly alignItems?: ResponsiveValue<CSSValue>;
    readonly alignSelf?: ResponsiveValue<CSSValue>;
    readonly justifyContent?: ResponsiveValue<CSSValue>;
    readonly justifySelf?: ResponsiveValue<CSSValue>;
    readonly gridTemplateColumns?: ResponsiveValue<CSSValue>;
    readonly gridTemplateRows?: ResponsiveValue<CSSValue>;
    readonly gridColumn?: ResponsiveValue<CSSValue>;
    readonly gridRow?: ResponsiveValue<CSSValue>;
    readonly placeItems?: ResponsiveValue<CSSValue>;
    readonly color?: ResponsiveValue<CSSValue>;
    readonly background?: ResponsiveValue<CSSValue>;
    readonly backgroundColor?: ResponsiveValue<CSSValue>;
    readonly borderColor?: ResponsiveValue<CSSValue>;
    readonly border?: ResponsiveValue<CSSValue>;
    readonly borderWidth?: ResponsiveValue<CSSValue>;
    readonly borderStyle?: ResponsiveValue<CSSValue>;
    readonly borderRadius?: ResponsiveValue<CSSValue>;
    readonly boxShadow?: ResponsiveValue<CSSValue>;
    readonly outline?: ResponsiveValue<CSSValue>;
    readonly opacity?: ResponsiveValue<CSSValue>;
    readonly fontFamily?: ResponsiveValue<CSSValue>;
    readonly fontSize?: ResponsiveValue<CSSValue>;
    readonly fontWeight?: ResponsiveValue<CSSValue>;
    readonly lineHeight?: ResponsiveValue<CSSValue>;
    readonly letterSpacing?: ResponsiveValue<CSSValue>;
    readonly textAlign?: ResponsiveValue<CSSValue>;
    readonly textDecoration?: ResponsiveValue<CSSValue>;
    readonly textTransform?: ResponsiveValue<CSSValue>;
    readonly whiteSpace?: ResponsiveValue<CSSValue>;
    readonly overflow?: ResponsiveValue<CSSValue>;
    readonly overflowX?: ResponsiveValue<CSSValue>;
    readonly overflowY?: ResponsiveValue<CSSValue>;
    readonly cursor?: ResponsiveValue<CSSValue>;
    readonly transition?: ResponsiveValue<CSSValue>;
    readonly transform?: ResponsiveValue<CSSValue>;
    readonly appearance?: ResponsiveValue<CSSValue>;
    readonly userSelect?: ResponsiveValue<CSSValue>;
    readonly pointerEvents?: ResponsiveValue<CSSValue>;
    /** Reactive CSS custom properties (`--name`) — the signal-driven channel (§6). */
    readonly vars?: Readonly<Record<`--${string}`, CSSValue>>;
}
/**
 * A full style definition: base declarations plus optional pseudo-state,
 * component-state and a11y-state overrides. Each override block is itself a set
 * of (non-responsive) declarations.
 */
interface StyleDef extends StyleProperties {
    /** Native pseudo-state overrides (`:hover`, `:focus-visible`, …) — §9. */
    readonly on?: Partial<Record<PseudoState, StyleProperties>>;
    /** Component-state overrides → `[data-<state>]` selectors — §10. */
    readonly when?: Partial<Record<ComponentState, StyleProperties>>;
}
/** A canonical, order-independent, JSON-serializable form of a `StyleDef`. */
type CanonicalStyle = string;
/** camelCase → kebab-case CSS property name (`backgroundColor` → `background-color`). */
declare function cssPropName(camel: string): string;
/** Format a CSS value: unitless numbers on length props get `px`; others pass through. */
declare function cssValue(prop: string, value: CSSValue): string;
/** Produce the canonical form of a style definition (stable across key order). */
declare function canonicalize(def: StyleDef): CanonicalStyle;
/**
 * FNV-1a (two seeds) → a stable, dependency-free class identity. Two 32-bit
 * passes are concatenated in base36 to make collisions between distinct styles
 * astronomically unlikely for realistic app style counts. Deterministic: the
 * same canonical form always yields the same id on server and client (§11/§12).
 */
declare function hashIdentity(canonical: CanonicalStyle): string;
/** Convenience: canonical form + identity in one call. */
declare function identityOf(def: StyleDef): {
    canonical: CanonicalStyle;
    id: string;
};

/**
 * StreetUI styling — the deduplicated CSS rule registry (§15/§18).
 *
 * A single module-level registry maps a *style identity* (`s-<hash>`) to the CSS
 * rule text for that style. Registration is idempotent: registering the same
 * identity twice with identical content is a no-op, so 10,000 elements that share
 * a style produce exactly one rule (§18). The registry is keyed by identity —
 * **never** by node or element — so it holds only bounded rule strings and
 * unmounting nodes never strands state in it (§17 memory-leak avoidance).
 *
 * Ordering is deterministic (insertion order within fixed category bands), so
 * serialization is byte-stable across runs (§11/§16). An empty registry
 * serializes to the empty string, mirroring `renderHead` — so a route that
 * declares no styles emits no `<style>` block and stays byte-identical.
 */
/** Category bands fix the serialization order regardless of registration order. */
type StyleBand = 'tokens' | 'base' | 'responsive' | 'state' | 'variant';
declare class StyleRegistry {
    private readonly _entries;
    private _seq;
    /** True once the registry has adopted a server-emitted stylesheet (§12). */
    private _adopted;
    /**
     * Register (idempotently) the CSS for a style identity. Returns the identity so
     * callers can chain. Re-registering an existing id with the same css is a no-op;
     * with different css it keeps the first registration (identity is content-derived,
     * so this cannot happen for honest input and signals a hash collision if it does).
     */
    register(id: string, band: StyleBand, css: string): string;
    /** Whether an identity is already present (server-adopted or locally registered). */
    has(id: string): boolean;
    /** Number of distinct rules held (bounded by source diversity, not instances). */
    get size(): number;
    /**
     * Seed the registry from identities a server stylesheet already shipped (§12).
     * We only need the *keys* to avoid re-emitting duplicates; the rule text is
     * already in the adopted `<style>` element, so a placeholder css is stored.
     */
    adoptServerIdentities(ids: Iterable<string>): void;
    get adopted(): boolean;
    /** Serialize all rules to a single CSS string in deterministic band order. */
    serializeCSS(): string;
    /** The ordered list of identities present (for the `data-streetui-css-keys` attr). */
    identities(): string[];
    /** Clear everything — test isolation and per-process reset only. */
    reset(): void;
}
/**
 * The process-wide registry instance. Because consuming packages (`dsl` authoring
 * and `renderer` SSR) both resolve `@streetui/core` to the *same* module, they
 * share this one instance — the authoring side registers rules and the SSR side
 * serializes them, with no cross-package plumbing.
 */
declare const styleRegistry: StyleRegistry;

/**
 * StreetUI styling — compile-time CSS generation (§7-§10, §15).
 *
 * Turns a `StyleDef` + its stable identity into CSS rule text. All generation is
 * pure and happens at author/compile time; nothing here runs per render. Output
 * is deterministic (properties sorted, fixed media order) so identities and bytes
 * are stable across server and client (§11/§16).
 *
 * Property values that are objects of the shape `{ base, sm, md, lg, xl }` expand
 * to a base declaration plus `@media (min-width: …)` blocks (§7). Pseudo states
 * (`on`) become `.id:hover` etc. (§9). Component states (`when`) become
 * `.id[data-<state>]` selectors driven reactively by a data attribute (§10).
 */

/** Default breakpoint minimum widths (px). Mirrors the default token breakpoints. */
declare const BREAKPOINTS: Readonly<Record<Exclude<Breakpoint, 'base'>, number>>;
/** `data-<state>` attribute name a component state maps to (§10). */
declare function stateAttr(state: ComponentState): string;
interface GeneratedCSS {
    /** Base rule + any responsive `@media` blocks. */
    readonly base: string;
    /** Pseudo-state and component-state rules (empty string when none). */
    readonly state: string;
    /** Whether the style declares any responsive values (for registry banding). */
    readonly hasResponsive: boolean;
}
/**
 * Generate the CSS for a style identity. The caller registers `base` under the
 * `base`/`responsive` band and `state` under the `state` band.
 */
declare function generateCSS(id: string, def: StyleDef): GeneratedCSS;

/**
 * StreetUI styling — first-class design tokens + theming (§6/§7/§16).
 *
 * Tokens are declared as a nested tree of named values and compiled to CSS custom
 * properties emitted once under `:root`, with dark-mode values emitted under
 * `[data-theme="dark"]`. A token *reference* is the string `var(--name)`, usable
 * anywhere a CSS value is expected inside a `StyleDef`. Dark mode therefore never
 * duplicates a style definition — it only re-points the variables (§7/§16).
 *
 * SSR/hydration safety: the token CSS is registered in the shared style registry
 * (tokens band) and serialized into the single `<style data-streetui-css>` block
 * like any other rule, so the server ships the variables and the client adopts
 * them. Switching theme is a single `data-theme` attribute flip on the root
 * element — no restyle work, no re-render (§16).
 */
type TokenLeaf = string | number;
interface TokenTree {
    readonly [key: string]: TokenLeaf | TokenTree;
}
/** The ref tree mirrors the input shape; every leaf becomes a `var(--…)` string. */
type TokenRefs<T> = {
    readonly [K in keyof T]: T[K] extends TokenLeaf ? string : T[K] extends TokenTree ? TokenRefs<T[K]> : never;
};
interface ThemeTokenDef<L extends TokenTree> {
    /** Base (light) token values — required; defines the full token surface. */
    readonly light: L;
    /** Dark overrides — a partial subset; unlisted tokens inherit the light value. */
    readonly dark?: DeepPartial<L>;
}
type DeepPartial<T> = {
    [K in keyof T]?: T[K] extends TokenLeaf ? TokenLeaf : T[K] extends TokenTree ? DeepPartial<T[K]> : never;
};
interface ThemeTokens<L extends TokenTree> {
    /** Token references (`var(--…)`) mirroring the declared tree. */
    readonly ref: TokenRefs<L>;
    /** The generated CSS for `:root` and `[data-theme="dark"]`. */
    readonly css: string;
    /** The stable identity under which this token block is registered. */
    readonly id: string;
}
/**
 * Declare a set of design tokens. Returns typed references and registers the
 * generated `:root` / `[data-theme="dark"]` CSS in the shared registry (idempotent).
 */
declare function createThemeTokens<L extends TokenTree>(def: ThemeTokenDef<L>): ThemeTokens<L>;
/**
 * The default StreetUI semantic token set (§6/§7). Covers color surfaces, content,
 * borders, accent, focus and danger semantics, plus spacing, radii, typography,
 * shadows, z-index, durations, easings and breakpoints. Dark mode re-points only
 * the color semantics; structural tokens (spacing, radii, …) are theme-invariant.
 */
declare const DEFAULT_TOKENS: {
    readonly surface: {
        readonly background: "#ffffff";
        readonly raised: "#f7f7f8";
        readonly sunken: "#eeeef1";
        readonly overlay: "rgba(17,17,20,0.55)";
    };
    readonly content: {
        readonly primary: "#17171a";
        readonly secondary: "#55555f";
        readonly muted: "#8a8a95";
        readonly inverse: "#ffffff";
    };
    readonly border: {
        readonly default: "#e3e3e8";
        readonly strong: "#c9c9d1";
        readonly subtle: "#f0f0f3";
    };
    readonly accent: {
        readonly primary: "#4f46e5";
        readonly hover: "#4338ca";
        readonly contrast: "#ffffff";
    };
    readonly focus: {
        readonly ring: "#6366f1";
    };
    readonly danger: {
        readonly surface: "#fef2f2";
        readonly border: "#fecaca";
        readonly content: "#b91c1c";
        readonly solid: "#dc2626";
    };
    readonly success: {
        readonly content: "#15803d";
        readonly solid: "#16a34a";
    };
    readonly space: {
        readonly '0': "0";
        readonly '1': "4px";
        readonly '2': "8px";
        readonly '3': "12px";
        readonly '4': "16px";
        readonly '5': "24px";
        readonly '6': "32px";
        readonly '8': "48px";
        readonly '10': "64px";
    };
    readonly radius: {
        readonly sm: "4px";
        readonly md: "8px";
        readonly lg: "12px";
        readonly xl: "16px";
        readonly full: "9999px";
    };
    readonly font: {
        readonly sans: "ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif";
        readonly mono: "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";
    };
    readonly size: {
        readonly xs: "12px";
        readonly sm: "14px";
        readonly md: "16px";
        readonly lg: "18px";
        readonly xl: "24px";
        readonly '2xl': "32px";
        readonly '3xl': "44px";
    };
    readonly weight: {
        readonly normal: "400";
        readonly medium: "500";
        readonly semibold: "600";
        readonly bold: "700";
    };
    readonly leading: {
        readonly tight: "1.2";
        readonly normal: "1.5";
        readonly relaxed: "1.7";
    };
    readonly shadow: {
        readonly sm: "0 1px 2px rgba(17,17,20,0.08)";
        readonly md: "0 4px 12px rgba(17,17,20,0.1)";
        readonly lg: "0 12px 32px rgba(17,17,20,0.16)";
    };
    readonly z: {
        readonly base: "0";
        readonly dropdown: "1000";
        readonly overlay: "1100";
        readonly toast: "1200";
    };
    readonly duration: {
        readonly fast: "120ms";
        readonly base: "200ms";
        readonly slow: "320ms";
    };
    readonly easing: {
        readonly standard: "cubic-bezier(0.2,0,0,1)";
        readonly emphasized: "cubic-bezier(0.3,0,0,1)";
    };
};
/** The ready-to-use default theme tokens, registered on import. */
declare const tokens: ThemeTokens<{
    readonly surface: {
        readonly background: "#ffffff";
        readonly raised: "#f7f7f8";
        readonly sunken: "#eeeef1";
        readonly overlay: "rgba(17,17,20,0.55)";
    };
    readonly content: {
        readonly primary: "#17171a";
        readonly secondary: "#55555f";
        readonly muted: "#8a8a95";
        readonly inverse: "#ffffff";
    };
    readonly border: {
        readonly default: "#e3e3e8";
        readonly strong: "#c9c9d1";
        readonly subtle: "#f0f0f3";
    };
    readonly accent: {
        readonly primary: "#4f46e5";
        readonly hover: "#4338ca";
        readonly contrast: "#ffffff";
    };
    readonly focus: {
        readonly ring: "#6366f1";
    };
    readonly danger: {
        readonly surface: "#fef2f2";
        readonly border: "#fecaca";
        readonly content: "#b91c1c";
        readonly solid: "#dc2626";
    };
    readonly success: {
        readonly content: "#15803d";
        readonly solid: "#16a34a";
    };
    readonly space: {
        readonly '0': "0";
        readonly '1': "4px";
        readonly '2': "8px";
        readonly '3': "12px";
        readonly '4': "16px";
        readonly '5': "24px";
        readonly '6': "32px";
        readonly '8': "48px";
        readonly '10': "64px";
    };
    readonly radius: {
        readonly sm: "4px";
        readonly md: "8px";
        readonly lg: "12px";
        readonly xl: "16px";
        readonly full: "9999px";
    };
    readonly font: {
        readonly sans: "ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif";
        readonly mono: "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";
    };
    readonly size: {
        readonly xs: "12px";
        readonly sm: "14px";
        readonly md: "16px";
        readonly lg: "18px";
        readonly xl: "24px";
        readonly '2xl': "32px";
        readonly '3xl': "44px";
    };
    readonly weight: {
        readonly normal: "400";
        readonly medium: "500";
        readonly semibold: "600";
        readonly bold: "700";
    };
    readonly leading: {
        readonly tight: "1.2";
        readonly normal: "1.5";
        readonly relaxed: "1.7";
    };
    readonly shadow: {
        readonly sm: "0 1px 2px rgba(17,17,20,0.08)";
        readonly md: "0 4px 12px rgba(17,17,20,0.1)";
        readonly lg: "0 12px 32px rgba(17,17,20,0.16)";
    };
    readonly z: {
        readonly base: "0";
        readonly dropdown: "1000";
        readonly overlay: "1100";
        readonly toast: "1200";
    };
    readonly duration: {
        readonly fast: "120ms";
        readonly base: "200ms";
        readonly slow: "320ms";
    };
    readonly easing: {
        readonly standard: "cubic-bezier(0.2,0,0,1)";
        readonly emphasized: "cubic-bezier(0.3,0,0,1)";
    };
}>;

/**
 * StreetUI styling — the public authoring API: `style()` and `styleVariants()`.
 *
 * `style(def)` canonicalizes a definition, registers its deduplicated CSS once,
 * and returns the stable class token (a plain string) to spread onto an element's
 * `class` (§2/§5/§18). Being a plain string makes it trivially composable and
 * tree-shakeable with no runtime dependency. A *static* `style()` call opens no
 * signal, no subscription and no effect (§3) — it is pure compile-time data.
 *
 * `styleVariants(cfg)` builds a type-safe family of styles. Variant group keys and
 * values are mapped types, so selecting an unknown group or value is a TypeScript
 * error (§11/§23) — no stringly-typed variant names. The returned function yields
 * the merged, deduped class list for a selection.
 */

/**
 * Register a style definition and return its class token. Idempotent: the same
 * definition always maps to the same token and a single shared CSS rule.
 */
declare function style(def: StyleDef): string;
/** Join class tokens/strings, dropping falsy entries. `cx('a', cond && 'b')`. */
declare function cx(...parts: Array<string | false | null | undefined>): string;
type VariantGroups = Record<string, Record<string, StyleDef>>;
interface VariantConfig<V extends VariantGroups> {
    /** Shared declarations applied to every variant combination. */
    readonly base?: StyleDef;
    /** Named variant groups; each maps a value name to its own `StyleDef`. */
    readonly variants: V;
    /** Default selection used when a group is omitted at call time. */
    readonly defaultVariants?: {
        readonly [K in keyof V]?: keyof V[K];
    };
}
/** A selection object: for each group, an optional value from that group. */
type VariantSelection<V extends VariantGroups> = {
    readonly [K in keyof V]?: keyof V[K];
};
/** The callable produced by `styleVariants` — `button({ intent:'danger' })`. */
type VariantFn<V extends VariantGroups> = (selection?: VariantSelection<V>) => string;
/**
 * Build a type-safe variant family. All base and variant-value styles are
 * registered up front (each as its own deduped identity), so calling the returned
 * function only *selects* among precompiled classes — no runtime style work (§11).
 */
declare function styleVariants<V extends VariantGroups>(cfg: VariantConfig<V>): VariantFn<V>;

export { type A11yIds, Application, type ApplicationId, type ApplicationOptions, BREAKPOINTS, BaseNode, type Breakpoint, type CSSValue, type CanonicalStyle, CleanupRegistry, type ComponentState, DEFAULT_TOKENS, type DeepPartial, type Diagnostic, DiagnosticCollector, type DiagnosticContext, DiagnosticError, type DiagnosticLocation, type DiagnosticSeverity, type DiagnosticSink, Environment, type EnvironmentCapabilities, type EnvironmentKind, type ErrorReport, type ErrorReportOptions, type GeneratedCSS, Lifecycle, type LifecycleHook, type LifecyclePhase, type NodeId, type NodeMetadata, type PseudoState, type ResponsiveValue, type SemanticNodeType, StreetFrameworkError, type StyleBand, type StyleDef, type StyleProperties, StyleRegistry, type ThemeTokenDef, type ThemeTokens, type TokenLeaf, type TokenRefs, type TokenTree, type VariantConfig, type VariantFn, type VariantGroups, type VariantSelection, a11yIds, canonicalize, consoleDiagnosticSink, createApplication, createNodeId, createThemeTokens, cssPropName, cssValue, cx, describeError, environment, formatDiagnostic, formatDiagnosticContext, frameworkError, generateApplicationId, generateCSS, generateNodeId, hashIdentity, identityOf, nextId, nodeIdPrefix, reportDiagnostic, reportError, resetIdCounter, stateAttr, style, styleRegistry, styleVariants, toIdToken, tokens };
