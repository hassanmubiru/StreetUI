import { C as CompiledApplication } from './compile-Cgx1PjG6.cjs';

/**
 * The interface the runtime uses to communicate with the renderer.
 *
 * The runtime never knows how DOM nodes are created — it delegates to this
 * interface. This keeps the runtime/renderer boundary clean.
 */

interface RenderHandle {
    /** Force a synchronous flush of pending updates. */
    flush(): void;
    /** Unmount and dispose all resources. */
    unmount(): void;
}
interface StreetRenderer {
    mount(application: CompiledApplication, container: Element): RenderHandle;
    /**
     * Optional: attach behavior to server-rendered HTML already present in
     * `container` instead of recreating it. Renderers that cannot hydrate may
     * omit this; callers fall back to `mount`.
     */
    hydrate?(application: CompiledApplication, container: Element): RenderHandle;
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

export { type HydrationDiagnostic as H, type RenderHandle as R, type StreetRenderer as S, type HydrationDiagnosticSink as a, type HydrationMismatchType as b, consoleHydrationDiagnosticSink as c, createHydrationDiagnosticCollector as d, formatHydrationDiagnostic as f };
