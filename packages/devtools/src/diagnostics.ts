/**
 * Dev-only performance diagnostics (v0.7 §21).
 *
 * A pure, cheap, count-based check that flags graph *shapes* known to correlate
 * with slow apps — very large graphs, deep trees, oversized lists/sections, and
 * heavy reactive fan-out. It is NOT wired into mount/render and adds ZERO cost
 * to the runtime hot path; a developer (or a CLI command, or a test) calls it
 * explicitly. Thresholds are advisory and overridable.
 *
 * This intentionally reuses the counts already produced by `inspectApplication`
 * — it introduces no second graph walk of its own beyond reading that snapshot.
 */

import type { CompiledApplication } from '@streetui/compiler';
import { inspectApplication } from './application.js';

export interface PerfThresholds {
  /** Warn when the graph exceeds this many nodes. */
  readonly maxNodes: number;
  /** Warn when nesting depth exceeds this. */
  readonly maxDepth: number;
  /** Warn when any single node has more than this many children (big list). */
  readonly maxChildCount: number;
  /** Warn when distinct signals exceed this (reactive fan-out). */
  readonly maxSignals: number;
}

export const DEFAULT_PERF_THRESHOLDS: PerfThresholds = {
  maxNodes: 5000,
  maxDepth: 32,
  maxChildCount: 1000,
  maxSignals: 1000,
};

export type PerfDiagnosticCode =
  | 'large-graph'
  | 'deep-tree'
  | 'large-list'
  | 'high-signal-fanout';

export interface PerfDiagnostic {
  readonly code: PerfDiagnosticCode;
  readonly message: string;
  /** The observed count that tripped the threshold. */
  readonly observed: number;
  /** The threshold it exceeded. */
  readonly threshold: number;
}

/**
 * Return advisory performance diagnostics for a compiled application. An empty
 * array means nothing tripped a threshold. Never throws; never mutates.
 */
export function diagnosePerformance(
  compiled: CompiledApplication,
  thresholds: Partial<PerfThresholds> = {},
): PerfDiagnostic[] {
  const t = { ...DEFAULT_PERF_THRESHOLDS, ...thresholds };
  const { perf } = inspectApplication(compiled);
  const out: PerfDiagnostic[] = [];

  if (perf.totalNodes > t.maxNodes) {
    out.push({
      code: 'large-graph',
      message: `Graph has ${perf.totalNodes} nodes (> ${t.maxNodes}); consider splitting the view or paginating.`,
      observed: perf.totalNodes,
      threshold: t.maxNodes,
    });
  }
  if (perf.maxDepth > t.maxDepth) {
    out.push({
      code: 'deep-tree',
      message: `Graph nests ${perf.maxDepth} levels deep (> ${t.maxDepth}); deep trees slow mount and reconciliation.`,
      observed: perf.maxDepth,
      threshold: t.maxDepth,
    });
  }
  if (perf.largestChildCount > t.maxChildCount) {
    out.push({
      code: 'large-list',
      message: `A single node has ${perf.largestChildCount} children (> ${t.maxChildCount}); large un-windowed lists dominate DOM cost.`,
      observed: perf.largestChildCount,
      threshold: t.maxChildCount,
    });
  }
  if (perf.distinctSignals > t.maxSignals) {
    out.push({
      code: 'high-signal-fanout',
      message: `${perf.distinctSignals} distinct signals are bound (> ${t.maxSignals}); heavy reactive fan-out increases update overhead.`,
      observed: perf.distinctSignals,
      threshold: t.maxSignals,
    });
  }

  return out;
}
