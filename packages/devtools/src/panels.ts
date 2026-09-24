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

import type { CompiledApplication } from '@streetui/compiler';
import type { ReadonlySignal } from '@streetui/state';
import {
  inspectApplication,
  type ApplicationInspection,
  type ApplicationIdentity,
  type InspectedPage,
} from './application.js';
import type { InspectedNode } from './inspector.js';
import { diagnosePerformance, type PerfDiagnostic, type PerfThresholds } from './diagnostics.js';
import {
  inspectSignal,
  inspectResource,
  inspectRouter,
  inspectForm,
  inspectContext,
  inspectI18n,
  type SignalInspection,
  type ResourceInspection,
  type RouterInspection,
  type FormInspection,
  type ContextInspection,
  type I18nInspection,
  type ResourceLike,
  type RouterLike,
  type FormLike,
  type ContextLike,
  type I18nLike,
} from './inspect-reactive.js';

// ── Panel shapes ────────────────────────────────────────────────────────────

export interface ApplicationPanel {
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

export interface SignalsPanel {
  /** Distinct signal ids referenced anywhere in the graph (structural). */
  readonly boundSignalIds: readonly string[];
  /** Live inspections for signals the app registered with DevTools, by label. */
  readonly live: Readonly<Record<string, SignalInspection>>;
}

export interface PerformancePanel {
  readonly snapshot: ApplicationInspection['perf'];
  readonly diagnostics: readonly PerfDiagnostic[];
}

/** All panels captured at one `refresh()`. */
export interface DevToolsSnapshot {
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

// ── Live sources ──────────────────────────────────────────────────────────

/**
 * The app's own live reactive objects, handed to DevTools explicitly so it can
 * inspect them. The compiled graph knows signal *ids* but not the live `Signal`
 * instances, so the app registers whichever surfaces it wants visible. Every
 * field is optional — a session works with none of them (structure-only).
 */
export interface DevToolsSources {
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

export interface DevToolsOptions {
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

// ── Session ─────────────────────────────────────────────────────────────────

/**
 * A headless DevTools session over one compiled application.
 *
 * The session holds the compiled app plus the app's registered live sources and
 * produces an immutable {@link DevToolsSnapshot} on demand. Live values are read
 * only when `refresh()` is called (explicit-refresh protocol, §7): the session
 * never subscribes to signals or instruments the reactive graph, so it adds no
 * cost to the running app between refreshes.
 */
export interface DevToolsSession {
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
export function createDevTools(
  compiled: CompiledApplication,
  sources: DevToolsSources = {},
  options: DevToolsOptions = {},
): DevToolsSession {
  let current = capture(compiled, sources, options);

  return {
    get snapshot() {
      return current;
    },
    refresh() {
      current = capture(compiled, sources, options);
      return current;
    },
    selectNode(id: string) {
      return findNode(current.graph, id);
    },
    format() {
      return formatSnapshot(current);
    },
  };
}

// ── Capture ───────────────────────────────────────────────────────────────

function capture(
  compiled: CompiledApplication,
  sources: DevToolsSources,
  options: DevToolsOptions,
): DevToolsSnapshot {
  const app: ApplicationInspection = inspectApplication(compiled);

  const application: ApplicationPanel = {
    identity: app.identity,
    nodeCount: app.perf.totalNodes,
    maxDepth: app.perf.maxDepth,
    pages: app.pages,
    signalCount: app.signals.length,
    eventHandlers: app.perf.eventHandlers,
    stateBindings: app.perf.stateBindings,
    errors: app.diagnostics.errors,
    warnings: app.diagnostics.warnings,
  };

  const live: Record<string, SignalInspection> = {};
  if (sources.signals !== undefined) {
    for (const [label, sig] of Object.entries(sources.signals)) {
      live[label] = inspectSignal(
        sig,
        options.redactSignals !== undefined ? { redact: options.redactSignals } : {},
      );
    }
  }
  const signals: SignalsPanel = { boundSignalIds: app.signals, live };

  const performance: PerformancePanel = {
    snapshot: app.perf,
    diagnostics: diagnosePerformance(compiled, options.perfThresholds),
  };

  const snapshot: DevToolsSnapshot = {
    application,
    graph: app.graph,
    signals,
    performance,
    ...(sources.router !== undefined ? { router: inspectRouter(sources.router) } : {}),
    ...(sources.resources !== undefined
      ? { resources: mapInspect(sources.resources, (r) => inspectResource(r)) }
      : {}),
    ...(sources.forms !== undefined
      ? { forms: mapInspect(sources.forms, (f) => inspectForm(f)) }
      : {}),
    ...(sources.contexts !== undefined
      ? { contexts: mapInspect(sources.contexts, (c) => inspectContext(c)) }
      : {}),
    ...(sources.i18n !== undefined
      ? {
          i18n: inspectI18n(
            sources.i18n,
            options.i18nCheckKeys !== undefined ? { checkKeys: options.i18nCheckKeys } : {},
          ),
        }
      : {}),
  };
  return snapshot;
}

function mapInspect<T, R>(
  source: Readonly<Record<string, T>>,
  inspect: (value: T) => R,
): Record<string, R> {
  const out: Record<string, R> = {};
  for (const [label, value] of Object.entries(source)) out[label] = inspect(value);
  return out;
}

// ── Graph node lookup (§8) ──────────────────────────────────────────────────

function findNode(node: InspectedNode, id: string): InspectedNode | undefined {
  if (node.id === id) return node;
  for (const child of node.children) {
    const found = findNode(child, id);
    if (found !== undefined) return found;
  }
  return undefined;
}

// ── Text formatter ────────────────────────────────────────────────────────

function formatSnapshot(s: DevToolsSnapshot): string {
  const lines: string[] = [];
  const app = s.application;
  lines.push(`StreetUI DevTools — ${app.identity.name} v${app.identity.version}`);
  lines.push(
    `Application: ${app.nodeCount} nodes, depth ${app.maxDepth}, ${app.pages.length} page(s)`,
  );
  lines.push(
    `  signals ${app.signalCount} · handlers ${app.eventHandlers} · bindings ${app.stateBindings} · errors ${app.errors} · warnings ${app.warnings}`,
  );

  lines.push(`Signals: ${s.signals.boundSignalIds.length} bound in graph`);
  for (const [label, sig] of Object.entries(s.signals.live)) {
    lines.push(`  ${label} [${sig.kind}] = ${format(sig.value)} · observers ${sig.observerCount ?? '?'}`);
  }

  if (s.router !== undefined) {
    lines.push(`Router: ${s.router.path} (${s.router.pattern})${s.router.isFallback ? ' [fallback]' : ''}`);
  }

  if (s.resources !== undefined) {
    lines.push('Resources:');
    for (const [label, r] of Object.entries(s.resources)) {
      lines.push(`  ${label}: ${r.status}${r.loading ? ' (loading)' : ''}${r.hasError ? ` !${r.errorName}` : ''}`);
    }
  }

  if (s.forms !== undefined) {
    lines.push('Forms:');
    for (const [label, f] of Object.entries(s.forms)) {
      lines.push(`  ${label}: ${f.valid ? 'valid' : 'invalid'} · ${f.status} · fields ${f.fields.length}`);
    }
  }

  if (s.contexts !== undefined) {
    lines.push('Contexts:');
    for (const [label, c] of Object.entries(s.contexts)) {
      lines.push(`  ${label} (${c.description}): ${c.hasProvider ? 'provided' : 'no provider'}`);
    }
  }

  if (s.i18n !== undefined) {
    const missing = s.i18n.missingKeys;
    lines.push(
      `i18n: ${s.i18n.locale} of [${s.i18n.locales.join(', ')}]${missing !== undefined ? ` · missing ${missing.length}` : ''}`,
    );
  }

  lines.push(
    `Performance: ${s.performance.diagnostics.length} diagnostic(s), ${s.performance.snapshot.totalNodes} nodes`,
  );
  for (const d of s.performance.diagnostics) {
    lines.push(`  ${d.code}: ${d.message}`);
  }

  return lines.join('\n');
}

function format(value: unknown): string {
  if (typeof value === 'string') return JSON.stringify(value);
  if (value === null || value === undefined) return String(value);
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '[object]';
    }
  }
  return String(value);
}
