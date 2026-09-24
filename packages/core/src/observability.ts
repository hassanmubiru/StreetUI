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
export interface DiagnosticContext {
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
export interface DiagnosticSink {
  debug?(message: string, context?: DiagnosticContext): void;
  info?(message: string, context?: DiagnosticContext): void;
  warn?(message: string, context?: DiagnosticContext): void;
  error?(message: string, context?: DiagnosticContext): void;
}

/** Format a context object as a compact ` [k=v, …]` suffix (empty when bare). */
export function formatDiagnosticContext(context?: DiagnosticContext): string {
  if (context === undefined) return '';
  const parts: string[] = [];
  if (context.package !== undefined) parts.push(`package=${context.package}`);
  if (context.operation !== undefined) parts.push(`operation=${context.operation}`);
  if (context.nodeId !== undefined) parts.push(`node=${context.nodeId}`);
  if (context.route !== undefined) parts.push(`route=${context.route}`);
  if (context.resource !== undefined) parts.push(`resource=${context.resource}`);
  return parts.length > 0 ? ` [${parts.join(', ')}]` : '';
}

/**
 * A framework error whose message carries structured, non-sensitive context so
 * a developer immediately sees which package/operation/node was involved. The
 * message never embeds a stack or environment values; production stack
 * disclosure decisions stay with the server layer.
 */
export class StreetFrameworkError extends Error {
  readonly context: DiagnosticContext | undefined;

  constructor(message: string, context?: DiagnosticContext) {
    super(`${message}${formatDiagnosticContext(context)}`);
    this.name = 'StreetFrameworkError';
    this.context = context ?? undefined;
  }
}

/** Build a `StreetFrameworkError` with the given context. */
export function frameworkError(
  message: string,
  context?: DiagnosticContext,
): StreetFrameworkError {
  return new StreetFrameworkError(message, context);
}

/**
 * Route a diagnostic to a sink if it implements the matching level. Safe to
 * call with `undefined` — it simply does nothing, which is the default (no
 * logging) posture. Never throws even if the sink method does.
 */
export function reportDiagnostic(
  sink: DiagnosticSink | undefined,
  level: 'debug' | 'info' | 'warn' | 'error',
  message: string,
  context?: DiagnosticContext,
): void {
  if (sink === undefined) return;
  const fn = sink[level];
  if (typeof fn !== 'function') return;
  try {
    fn.call(sink, message, context);
  } catch {
    // A misbehaving sink must never break the framework.
  }
}

/** A sink that forwards to a `console`-like object, one call per level. */
export function consoleDiagnosticSink(
  logger: Partial<Record<'debug' | 'info' | 'warn' | 'error', (msg: string) => void>> = console,
): DiagnosticSink {
  return {
    debug: (m, c) => logger.debug?.(`${m}${formatDiagnosticContext(c)}`),
    info: (m, c) => logger.info?.(`${m}${formatDiagnosticContext(c)}`),
    warn: (m, c) => logger.warn?.(`${m}${formatDiagnosticContext(c)}`),
    error: (m, c) => logger.error?.(`${m}${formatDiagnosticContext(c)}`),
  };
}
