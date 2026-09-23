/**
 * Compiler-phase validation of the ApplicationGraph.
 *
 * This runs after the DSL has built the graph but before the runtime
 * receives a CompiledApplication. More checks live here than in the
 * graph's own validate() because the compiler has broader context.
 */

import { DiagnosticCollector } from '@streetui/core';
import { ApplicationGraph, GraphNode } from '@streetui/graph';

export function validateGraph(graph: ApplicationGraph): DiagnosticCollector {
  const dc = new DiagnosticCollector();

  // Merge built-in graph validations
  dc.merge(graph.validate());

  // Must have at least one page
  const pages = graph.findByType('page');
  if (pages.length === 0) {
    dc.warn(
      'COMPILER_NO_PAGES',
      'Application has no pages defined. At least one page is recommended.',
    );
  }

  // Walk and validate individual nodes
  graph.walk((node) => {
    validateNode(node, dc);
  });

  return dc;
}

function validateNode(node: GraphNode, dc: DiagnosticCollector): void {
  switch (node.type) {
    case 'heading': {
      const text = node.getProp('text');
      if (text === undefined || text === '') {
        dc.warn('COMPILER_EMPTY_HEADING', `Heading node "${node.id}" has no text content`, {
          nodeId: node.id,
        });
      }
      break;
    }
    case 'image': {
      const src = node.getProp('src');
      const alt = node.getProp('alt');
      if (!src) {
        dc.error('COMPILER_IMAGE_NO_SRC', `Image node "${node.id}" is missing src`, {
          nodeId: node.id,
        });
      }
      if (!alt) {
        dc.warn('COMPILER_IMAGE_NO_ALT', `Image node "${node.id}" is missing alt text`, {
          nodeId: node.id,
        });
      }
      break;
    }
    case 'link': {
      const href = node.getProp('href');
      if (!href) {
        dc.error('COMPILER_LINK_NO_HREF', `Link node "${node.id}" is missing href`, {
          nodeId: node.id,
        });
      }
      break;
    }
    default:
      break;
  }
}
