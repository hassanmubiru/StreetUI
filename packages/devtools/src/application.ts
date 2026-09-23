/**
 * DevTools foundation (v0.6, Phase 18). A single read-only entry point that
 * aggregates everything an eventual DevTools UI would need — application
 * identity, the graph tree, signal bindings, page/route surface, node
 * statistics, and diagnostics — WITHOUT introducing a second representation of
 * the graph. It reuses `inspectGraph`/`nodeTypeStats` from the inspector and
 * reads `CompiledApplication` metadata directly. This is a foundation, not a
 * UI: it returns plain data so a UI (or a test, or a CLI command) can render it.
 */

import type { CompiledApplication } from '@streetui/compiler';
import { formatDiagnostic } from '@streetui/core';
import { inspectGraph, nodeTypeStats, type InspectedNode } from './inspector.js';

/** Stable identity of a compiled application. */
export interface ApplicationIdentity {
  readonly name: string;
  readonly version: string;
  /** Epoch millis the application was compiled. */
  readonly compiledAt: number;
}

/** A page node reachable as a direct child of the application root. */
export interface InspectedPage {
  readonly id: string;
  /** The page key when one was supplied in the DSL. */
  readonly key: string | undefined;
}

/** Compilation diagnostics summarised for display. */
export interface DiagnosticsSummary {
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
export interface PerfSnapshot {
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
export interface ApplicationInspection {
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

/** Walk the inspected tree once, accumulating the count-only perf snapshot. */
function collectPerf(
  node: InspectedNode,
  distinctSignals: number,
  acc: { totalNodes: number; maxDepth: number; eventHandlers: number; stateBindings: number; largestChildCount: number },
): void {
  acc.totalNodes += 1;
  if (node.depth > acc.maxDepth) acc.maxDepth = node.depth;
  acc.eventHandlers += node.eventTypes.length;
  acc.stateBindings += node.stateBindings.length;
  if (node.children.length > acc.largestChildCount) acc.largestChildCount = node.children.length;
  for (const child of node.children) collectPerf(child, distinctSignals, acc);
}

/** Collect every distinct signal id referenced by any node in the tree. */
function collectSignals(node: InspectedNode, into: Set<string>): void {
  for (const binding of node.stateBindings) {
    // Bindings are formatted `propKey→signalId` by the inspector.
    const arrow = binding.indexOf('→');
    const signalId = arrow >= 0 ? binding.slice(arrow + 1) : binding;
    if (signalId.length > 0) into.add(signalId);
  }
  for (const child of node.children) collectSignals(child, into);
}

/**
 * Build the full inspection snapshot for a compiled application. Pure and
 * side-effect free — safe to call in a server, a test, or a DevTools panel.
 */
export function inspectApplication(compiled: CompiledApplication): ApplicationInspection {
  const graph = inspectGraph(compiled.graph);

  const signals = new Set<string>();
  collectSignals(graph, signals);

  const pages: InspectedPage[] = graph.children
    .filter((child) => child.type === 'page')
    .map((child) => ({ id: child.id, key: child.key }));

  const diags = compiled.diagnostics.diagnostics;
  const errors = diags.filter((d) => d.severity === 'error').length;

  const perfAcc = { totalNodes: 0, maxDepth: 0, eventHandlers: 0, stateBindings: 0, largestChildCount: 0 };
  collectPerf(graph, signals.size, perfAcc);

  return {
    identity: {
      name: compiled.name,
      version: compiled.version,
      compiledAt: compiled.compiledAt,
    },
    graph,
    nodeStats: nodeTypeStats(compiled.graph),
    signals: [...signals].sort(),
    pages,
    diagnostics: {
      errors,
      warnings: diags.length - errors,
      messages: diags.map(formatDiagnostic),
    },
    perf: {
      totalNodes: perfAcc.totalNodes,
      maxDepth: perfAcc.maxDepth,
      eventHandlers: perfAcc.eventHandlers,
      stateBindings: perfAcc.stateBindings,
      distinctSignals: signals.size,
      largestChildCount: perfAcc.largestChildCount,
    },
  };
}
