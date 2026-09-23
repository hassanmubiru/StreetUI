/**
 * RenderContext — shared state for a single mount operation.
 *
 * Passed through the render pipeline so every sub-function has access
 * to the DOM adapter, graph, and instance map without prop-drilling.
 */

import type { DOMAdapter } from '@streetui/dom';
import type { ApplicationGraph, GraphNode } from '@streetui/graph';
import type { NodeInstance } from './node-instance.js';

export interface RenderContext {
  readonly dom: DOMAdapter;
  readonly graph: ApplicationGraph;
  /** Maps GraphNode.id → its live NodeInstance */
  readonly instances: Map<string, NodeInstance>;
  /** The root container element. */
  readonly container: Element;
}

export function createRenderContext(
  dom: DOMAdapter,
  graph: ApplicationGraph,
  container: Element,
): RenderContext {
  return {
    dom,
    graph,
    instances: new Map(),
    container,
  };
}
