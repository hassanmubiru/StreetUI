/**
 * RenderContext — shared state for a single mount operation.
 *
 * Passed through the render pipeline so every sub-function has access
 * to the DOM adapter, graph, and instance map without prop-drilling.
 */

import type { DOMAdapter } from '@streetui/dom';
import type { ApplicationGraph, GraphNode } from '@streetui/graph';
import type { NodeInstance } from './node-instance.js';
import type { HydrationDiagnosticSink } from './hydration-diagnostics.js';

export interface RenderContext {
  readonly dom: DOMAdapter;
  readonly graph: ApplicationGraph;
  /** Maps GraphNode.id → its live NodeInstance */
  readonly instances: Map<string, NodeInstance>;
  /** The root container element. */
  readonly container: Element;
  /**
   * Optional dev-only sink that observes hydration mismatch repairs. When
   * absent (the default) the hydration path does no extra work — this is how
   * DevTools/diagnostics stay off the production runtime path.
   */
  readonly hydrationDiagnostics?: HydrationDiagnosticSink;
  /**
   * Optional SSR-only static-subtree plan (v1.7). Maps a maximal
   * static-subtree root GraphNode.id → its precomputed, verbatim HTML string.
   * Present only on the server render path when a plan has been built; on the
   * browser mount path it is always `undefined`, so the client hot path is
   * unaffected (a single `=== undefined` check short-circuits). When a mounted
   * node's id is in this map, the renderer emits the precomputed HTML via
   * `dom.createRawHTML` instead of recursively constructing the subtree.
   */
  readonly staticHTML?: ReadonlyMap<string, string>;
}

export function createRenderContext(
  dom: DOMAdapter,
  graph: ApplicationGraph,
  container: Element,
  hydrationDiagnostics?: HydrationDiagnosticSink,
  staticHTML?: ReadonlyMap<string, string>,
): RenderContext {
  return {
    dom,
    graph,
    instances: new Map(),
    container,
    ...(hydrationDiagnostics !== undefined ? { hydrationDiagnostics } : {}),
    ...(staticHTML !== undefined ? { staticHTML } : {}),
  };
}
