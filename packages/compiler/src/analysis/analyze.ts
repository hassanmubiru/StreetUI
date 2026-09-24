/**
 * Static graph analysis (v1.2, spec §3/§12/§14).
 *
 * A single post-order walk over the Semantic Application Graph that classifies
 * every node as static (no bound signals, no events, not a reactive
 * region) or dynamic, and rolls that up into whole-static-subtree flags. This
 * is COMPILE-TIME metadata only — it introduces no virtual DOM, no second tree
 * and no runtime reactive system. It is consumed by:
 *   - the hydration path, to skip per-node attribute/text re-verification on
 *     provably-static subtrees (§12), and
 *   - the diagnostic compiler-inspection report (§14).
 *
 * The renderer's initial-mount fast path does not need this map: it already
 * skips reactive wiring per node via cheap `events.length`/`stateRefs.length`
 * guards. Keeping the analysis out of the mount hot path avoids adding lookup
 * cost (and keeps the shipped runtime lean).
 */

import type { NodeId } from '@streetui/core';
import type { ApplicationGraph, GraphNode } from '@streetui/graph';

/** Prop keys whose bound signal drives text content rather than an attribute. */
const TEXT_PROP_KEYS: ReadonlySet<string> = new Set(['text', 'label', 'value']);

export interface NodeAnalysis {
  /** No bound signals, no events, and not a reactive-list/conditional region. */
  readonly isStatic: boolean;
  /** This node is static AND every descendant is a static subtree. */
  readonly isStaticSubtree: boolean;
  /** A signal is bound to this node's text/label/value content. */
  readonly hasDynamicText: boolean;
  /** A signal is bound to a non-content prop (a reactive attribute). */
  readonly hasDynamicAttr: boolean;
  /** This node wires one or more DOM event handlers. */
  readonly hasEvents: boolean;
  /** This node is a keyed reactive list. */
  readonly isList: boolean;
  /** This node is a conditional (0..1 branch) region. */
  readonly isConditional: boolean;
}

export interface GraphAnalysisSummary {
  readonly totalNodes: number;
  readonly staticNodes: number;
  readonly staticSubtrees: number;
  readonly dynamicTextNodes: number;
  readonly dynamicAttrNodes: number;
  readonly eventNodes: number;
  readonly lists: number;
  readonly conditionals: number;
}

export interface GraphAnalysis {
  readonly nodes: ReadonlyMap<NodeId, NodeAnalysis>;
  readonly summary: GraphAnalysisSummary;
}

/**
 * Analyze a fully-built graph. O(n) single post-order pass; allocates one small
 * record per node. Safe to skip entirely when neither hydration nor diagnostics
 * need it.
 */
export function analyzeGraph(graph: ApplicationGraph): GraphAnalysis {
  const nodes = new Map<NodeId, NodeAnalysis>();
  const summary = {
    totalNodes: 0, staticNodes: 0, staticSubtrees: 0, dynamicTextNodes: 0,
    dynamicAttrNodes: 0, eventNodes: 0, lists: 0, conditionals: 0,
  };

  const visit = (node: GraphNode): boolean => {
    // Post-order: children first so subtree rollup is exact.
    let allChildrenStatic = true;
    for (const child of node.children) {
      const childSubtreeStatic = visit(child);
      if (!childSubtreeStatic) allChildrenStatic = false;
    }

    let hasDynamicText = false;
    let hasDynamicAttr = false;
    for (const ref of node.stateRefs) {
      if (TEXT_PROP_KEYS.has(ref.propKey)) hasDynamicText = true;
      else hasDynamicAttr = true;
    }
    const hasEvents = node.events.length > 0;
    const isList = node.type === 'reactive-list';
    const isConditional = node.type === 'conditional';
    const isStatic =
      node.stateRefs.length === 0 && !hasEvents && !isList && !isConditional;
    const isStaticSubtree = isStatic && allChildrenStatic;

    nodes.set(node.id, {
      isStatic, isStaticSubtree, hasDynamicText, hasDynamicAttr,
      hasEvents, isList, isConditional,
    });

    summary.totalNodes += 1;
    if (isStatic) summary.staticNodes += 1;
    if (isStaticSubtree) summary.staticSubtrees += 1;
    if (hasDynamicText) summary.dynamicTextNodes += 1;
    if (hasDynamicAttr) summary.dynamicAttrNodes += 1;
    if (hasEvents) summary.eventNodes += 1;
    if (isList) summary.lists += 1;
    if (isConditional) summary.conditionals += 1;

    return isStaticSubtree;
  };

  visit(graph.root);
  return { nodes, summary };
}
