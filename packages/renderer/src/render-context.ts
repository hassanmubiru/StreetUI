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
}

export function createRenderContext(
  dom: DOMAdapter,
  graph: ApplicationGraph,
  container: Element,
  hydrationDiagnostics?: HydrationDiagnosticSink,
): RenderContext {
  return {
    dom,
    graph,
    instances: new Map(),
    container,
    ...(hydrationDiagnostics !== undefined ? { hydrationDiagnostics } : {}),
  };
}
