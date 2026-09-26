/**
 * Static SSR Plan (v1.7, spec §4/§6) — internal.
 *
 * A compiler-derived plan that precomputes the verbatim HTML of every *maximal
 * static subtree* in an application graph. During SSR, the renderer emits that
 * precomputed string directly (via `ServerDOMAdapter.createRawHTML`) instead of
 * recursively constructing a `ServerElement`/`ServerText`/`NodeInstance` for
 * every node in the subtree. On the 10k-row `/users` corpus, ~100% of the node
 * mass lives in 10,000 static 8-node row subtrees, so collapsing each row into
 * one precomputed string removes the bulk of the mount-phase construction work.
 *
 * Design constraints honoured here:
 *  - §3 REUSE the existing compiler analysis (`analyzeGraph`) to classify nodes;
 *    no new/expensive analysis, and nothing runs during normal `compile()`.
 *  - §5/§15 Only *maximal static-subtree roots* are collapsed. A dynamic region
 *    (reactive-list container, conditional, dynamic-text/attr node) is never
 *    treated as static — the list itself stays dynamic; only the provably-static
 *    subtree *inside* each repeated item is precomputed.
 *  - §8 The precomputed HTML is produced by the SAME mount + serialize pipeline
 *    as the runtime path, so full-render output is byte-identical.
 *  - §19 The plan retains ONLY strings keyed by GraphNode.id. No ServerDOM node,
 *    NodeInstance or application object is retained (the throwaway build tree is
 *    disposed + cleared). The per-app cache is a WeakMap, so a plan is released
 *    when its CompiledApplication is collected.
 *  - §24 Everything here is internal: not re-exported from the `streetui` or
 *    `streetui/server` runtime barrels.
 *
 * This module is only ever imported by the SSR entry (`renderToString`), which
 * is itself reachable solely through the server path, so it tree-shakes out of
 * client bundles (§20, verified by bundle measurement).
 */

import type { NodeId } from '@streetui/core';
import type { ApplicationGraph, GraphNode } from '@streetui/graph';
import type { CompiledApplication } from '@streetui/compiler';
import { analyzeGraph } from '@streetui/compiler/diagnostics';
import { ServerDOMAdapter } from '@streetui/dom';
import { createRenderContext } from './render-context.js';
import { mountNode } from './mount.js';

/**
 * Internal representation of the static SSR plan: maximal static-subtree root
 * GraphNode.id → its precomputed, verbatim outer HTML. A plain `Map<string,
 * string>` is deliberate — it holds no DOM/application references (§19).
 */
export type StaticSSRPlan = ReadonlyMap<NodeId, string>;

/**
 * Collect the ids of every *maximal* static-subtree root under `graph`.
 *
 * Walk from the root; when a node is itself a whole static subtree, it is a
 * maximal root — record it and stop (its static descendants are subsumed).
 * Otherwise descend into its children, so a dynamic node's individually-static
 * children are still captured (the mixed-tree case, §5). The `application` root
 * is never recorded: it maps onto the render container rather than emitting its
 * own element, so we always descend past it into its real top-level children.
 */
function collectMaximalStaticRoots(graph: ApplicationGraph): GraphNode[] {
  const analysis = analyzeGraph(graph);
  const roots: GraphNode[] = [];

  const walk = (node: GraphNode): void => {
    if (node.type !== 'application') {
      const a = analysis.nodes.get(node.id);
      if (a !== undefined && a.isStaticSubtree) {
        roots.push(node);
        return;
      }
    }
    for (const child of node.children) walk(child);
  };

  walk(graph.root);
  return roots;
}

/**
 * Serialize the outer HTML of a single static subtree using the exact runtime
 * mount + serialize pipeline (so the bytes match a full render). The throwaway
 * tree is disposed immediately, so nothing is retained.
 */
function serializeStaticSubtree(
  dom: ServerDOMAdapter,
  graph: ApplicationGraph,
  root: GraphNode,
): string {
  const container = dom.createElement('div');
  // No `staticHTML` on this ctx → mountNode builds the subtree fully.
  const ctx = createRenderContext(dom, graph, container);
  const instance = mountNode(ctx, root, container);
  const html = dom.serializeInner(container);
  // Tear down (static subtrees open no subscriptions, but keep symmetry with
  // renderToString's lifecycle) and drop all references.
  instance.dispose();
  ctx.instances.clear();
  return html;
}

/**
 * Build the static SSR plan for a compiled application. O(n) analysis + one
 * mount/serialize per maximal static subtree. Returns an empty map when the app
 * has no static subtrees (e.g. a highly-dynamic page) — the SSR path then
 * behaves exactly as v1.6.
 */
export function buildStaticSSRPlan(compiled: CompiledApplication): StaticSSRPlan {
  const graph = compiled.graph;
  const roots = collectMaximalStaticRoots(graph);
  const plan = new Map<NodeId, string>();
  if (roots.length === 0) return plan;

  const dom = new ServerDOMAdapter();
  for (const root of roots) {
    plan.set(root.id, serializeStaticSubtree(dom, graph, root));
  }
  return plan;
}

/**
 * Per-application plan cache. A WeakMap keyed by the CompiledApplication so a
 * plan is built once and reused across renders, and is released together with
 * the compiled app it belongs to — no long-lived retention of app state (§19).
 */
const PLAN_CACHE = new WeakMap<CompiledApplication, StaticSSRPlan>();

/** Get the cached static SSR plan for a compiled app, building it on first use. */
export function getStaticSSRPlan(compiled: CompiledApplication): StaticSSRPlan {
  let plan = PLAN_CACHE.get(compiled);
  if (plan === undefined) {
    plan = buildStaticSSRPlan(compiled);
    PLAN_CACHE.set(compiled, plan);
  }
  return plan;
}
