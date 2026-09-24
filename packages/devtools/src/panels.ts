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
