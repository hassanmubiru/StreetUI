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
export type HydrationMismatchType =
  | 'tag-mismatch' // an element existed but was the wrong tag
  | 'missing-element' // the graph expected a child the DOM did not provide
  | 'surplus-element'; // the DOM had a child the graph no longer expects

/** A single, fully-described hydration divergence and the repair taken. */
export interface HydrationDiagnostic {
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
export interface HydrationDiagnosticSink {
  report(diagnostic: HydrationDiagnostic): void;
}

/** Build the canonical one-line message for a diagnostic. */
export function formatHydrationDiagnostic(
  d: Omit<HydrationDiagnostic, 'message'>,
): string {
  const at = ` at ${d.path}`;
  switch (d.type) {
    case 'tag-mismatch':
      return `Hydration mismatch${at} — Expected: ${d.expected} / Found: ${d.found} / Action: ${d.action}`;
    case 'missing-element':
      return `Hydration mismatch${at} — Expected: ${d.expected} / Found: (nothing) / Action: ${d.action}`;
    case 'surplus-element':
      return `Hydration mismatch${at} — Expected: (nothing) / Found: ${d.found} / Action: ${d.action}`;
  }
}

/**
 * A ready-made sink that accumulates diagnostics into an array — the shape most
 * useful for tests and for a DevTools panel. The returned `diagnostics` array is
 * appended to in-place as repairs happen.
 */
export function createHydrationDiagnosticCollector(): {
  readonly sink: HydrationDiagnosticSink;
  readonly diagnostics: HydrationDiagnostic[];
} {
  const diagnostics: HydrationDiagnostic[] = [];
  return {
    diagnostics,
    sink: {
      report(d) {
        diagnostics.push(d);
      },
    },
  };
}

/**
 * A sink that forwards each diagnostic to a `console`-like logger as a single
 * warning line. Handy default when you just want the messages surfaced in dev.
 */
export function consoleHydrationDiagnosticSink(
  logger: { warn(message: string): void } = console,
): HydrationDiagnosticSink {
  return {
    report(d) {
      logger.warn(d.message);
    },
  };
}
