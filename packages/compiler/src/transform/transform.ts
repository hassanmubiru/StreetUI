/**
 * Graph transformation pass.
 *
 * After validation, the transformer prepares the graph for the runtime by:
 *  - Resolving implicit defaults (e.g. heading level defaults to 1)
 *  - Normalizing prop names
 *  - Assigning deterministic render keys where missing
 *  - Flattening / hoisting where beneficial
 */

import { ApplicationGraph, GraphNode } from '@streetui/graph';

export function transformGraph(graph: ApplicationGraph): void {
  graph.walk((node, depth) => {
    applyDefaults(node);
    ensureRenderKey(node, depth);
  });
}

function applyDefaults(node: GraphNode): void {
  switch (node.type) {
    case 'heading': {
      if (node.getProp('level') === undefined) {
        node.setProp('level', 1);
      }
      break;
    }
    case 'input': {
      if (node.getProp('inputType') === undefined) {
        node.setProp('inputType', 'text');
      }
      break;
    }
    case 'link': {
      if (node.getProp('external') === undefined) {
        node.setProp('external', false);
      }
      break;
    }
    default:
      break;
  }
}

function ensureRenderKey(node: GraphNode, depth: number): void {
  if (node.getProp('_renderKey') === undefined) {
    const key = node.key ?? `${node.type}:${node.id}:${depth}`;
    node.setProp('_renderKey', key);
  }
}
