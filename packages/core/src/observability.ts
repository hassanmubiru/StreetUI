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
  if (context.component !== undefined) parts.push(`component=${context.component}`);
  if (context.phase !== undefined) parts.push(`phase=${context.phase}`);
  if (context.nodeId !== undefined) parts.push(`node=${context.nodeId}`);
  if (context.element !== undefined) parts.push(`element=${context.element}`);
  if (context.route !== undefined) parts.push(`route=${context.route}`);
  if (context.resource !== undefined) parts.push(`resource=${context.resource}`);
  if (context.signal !== undefined) parts.push(`signal=${context.signal}`);
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

// ── Production error diagnostics (2.0 §7) ─────────────────────────────────────

/**
 * Options controlling how much of an error is disclosed in a report.
 *
 * Everything defaults to the SAFE (production) posture: no stack, no cause
 * chain. A stack trace can embed absolute file paths and, in some runtimes,
 * source fragments, so it is opt-in and belongs to development / trusted server
 * logging — never to a report that might reach a browser or a third party.
 */
export interface ErrorReportOptions {
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
export interface ErrorReport {
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

function describeErrorAt(
  error: unknown,
  context: DiagnosticContext | undefined,
  options: ErrorReportOptions,
  depth: number,
): ErrorReport {
  const isError = error instanceof Error;
  const name = isError ? error.name : 'Error';
  // For a real Error, use its (author-controlled) message. For anything else,
  // stringify it — but never enumerate its properties, which may hold user data.
  const message = isError ? error.message : safeStringify(error);

  const report: {
    name: string;
    message: string;
    isError: boolean;
    context?: DiagnosticContext;
    stack?: string;
    cause?: ErrorReport;
  } = { name, message, isError };

  if (context !== undefined) report.context = context;
  if (options.includeStack === true && isError && typeof error.stack === 'string') {
    report.stack = error.stack;
  }
  if (options.includeCause === true && isError && depth < 4) {
    const cause = (error as { cause?: unknown }).cause;
    if (cause !== undefined && cause !== null) {
      report.cause = describeErrorAt(cause, undefined, options, depth + 1);
    }
  }
  return report;
}

/** Stringify a non-Error throw without ever enumerating its properties. */
function safeStringify(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  const t = typeof value;
  if (t === 'number' || t === 'boolean' || t === 'bigint' || t === 'symbol') {
    return String(value);
  }
  // Objects/functions: report only the type + constructor name, never contents.
  const ctor =
    t === 'object' && value !== null
      ? ((value as object).constructor?.name ?? 'Object')
      : t;
  return `[non-Error ${ctor}]`;
}

/**
 * Build a {@link ErrorReport} from any thrown value and (optionally) the
 * framework {@link DiagnosticContext} it surfaced in. Production-safe by
 * default: no stack, no cause, no enumerated properties. This is a pure
 * function — it performs no logging and has no side effects, so it is safe to
 * call from any layer (an `errorBoundary` `onError`, an `asyncBoundary` error
 * branch, a resource loader `catch`).
 */
export function describeError(
  error: unknown,
  context?: DiagnosticContext,
  options: ErrorReportOptions = {},
): ErrorReport {
  return describeErrorAt(error, context, options, 0);
}

/**
 * Convenience bridge: build a production-safe {@link ErrorReport} and route it
 * to a {@link DiagnosticSink} at the `error` level. The sink receives the
 * report's message and the structured {@link DiagnosticContext}; the full
 * report is returned to the caller for forwarding elsewhere (e.g. an app's own
 * crash reporter). Safe with `undefined` sink (no-op) and never throws.
 */
export function reportError(
  sink: DiagnosticSink | undefined,
  error: unknown,
  context?: DiagnosticContext,
  options: ErrorReportOptions = {},
): ErrorReport {
  const report = describeError(error, context, options);
  reportDiagnostic(sink, 'error', report.message, report.context);
  return report;
}
