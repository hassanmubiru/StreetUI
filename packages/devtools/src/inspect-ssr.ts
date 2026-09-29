/**
 * SSR / Hydration inspection for DevTools (2.2 Phase 1, panel #12).
 *
 * A structural, read-only view of how a compiled application splits into the
 * parts that are *statically serialized* on the server versus the *dynamic*
 * parts the client must hydrate. It reuses the compiler's existing
 * `analyzeGraph` classifier (the very same analysis the SSR static-subtree plan
 * and the hydration fast-path already consume) so DevTools introduces no second
 * analysis and no second graph. Nothing is measured at runtime and nothing is
 * mutated — this is a pure derivation over the one `CompiledApplication`.
 *
 * HONEST SCOPE: these are *structural* counts (how many nodes are static, how
 * many hydrate, how many portals/islands exist). They are NOT wall-clock SSR or
 * hydration timings — real render/hydrate timing needs a browser, and the
 * browser gate is BLOCKED in this environment. The panel labels this honestly.
 */

import type { CompiledApplication } from '@streetui/compiler';
import { analyzeGraph } from '@streetui/compiler/diagnostics';
import type { ApplicationGraph } from '@streetui/graph';

export interface HydrationInspection {
  /** Total GraphNodes analysed (root included). */
  readonly totalNodes: number;
  /** Nodes classified static (no dynamic text/attr/events of their own). */
  readonly staticNodes: number;
  /** Maximal whole-static subtrees — the units the SSR plan precomputes verbatim. */
  readonly staticSubtrees: number;
  /** Dynamic nodes the client must reconcile/hydrate (total − static). */
  readonly dynamicNodes: number;
  /** Nodes with dynamic (signal-bound) text. */
  readonly dynamicTextNodes: number;
  /** Nodes with dynamic (signal-bound) attributes. */
  readonly dynamicAttrNodes: number;
  /** Nodes carrying event handlers — the interactive surface hydration wires. */
  readonly eventNodes: number;
  /** Reactive keyed-list sites. */
  readonly lists: number;
  /** Conditional (`when`) sites. */
  readonly conditionals: number;
  /** Portal hosts (overlays) — relocated to <body> on hydrate, inlined in SSR. */
  readonly portals: number;
  /** `head()` contribution anchors — adopted, never duplicated, on hydrate. */
  readonly headAnchors: number;
  /**
   * Fraction of nodes that are static (0..1), rounded to 4 dp. A high ratio
   * means most of the document ships as precomputed HTML and hydration only
   * wires the dynamic remainder. Deterministic; no timing involved.
   */
  readonly staticRatio: number;
}

/** Count graph nodes of a given semantic type (one structural walk). */
function countType(graph: ApplicationGraph, type: string): number {
  let n = 0;
  graph.walk((node) => {
    if (node.type === type) n += 1;
  });
  return n;
}

/**
 * Build the SSR/hydration inspection for a compiled application. Pure and
 * side-effect free — safe in a server, a test, or a DevTools panel.
 */
export function inspectHydration(compiled: CompiledApplication): HydrationInspection {
  const graph = compiled.graph;
  const { summary } = analyzeGraph(graph);
  const dynamicNodes = summary.totalNodes - summary.staticNodes;
  const staticRatio =
    summary.totalNodes === 0
      ? 0
      : Math.round((summary.staticNodes / summary.totalNodes) * 1e4) / 1e4;

  return {
    totalNodes: summary.totalNodes,
    staticNodes: summary.staticNodes,
    staticSubtrees: summary.staticSubtrees,
    dynamicNodes,
    dynamicTextNodes: summary.dynamicTextNodes,
    dynamicAttrNodes: summary.dynamicAttrNodes,
    eventNodes: summary.eventNodes,
    lists: summary.lists,
    conditionals: summary.conditionals,
    portals: countType(graph, 'portal'),
    headAnchors: countType(graph, 'head'),
    staticRatio,
  };
}
