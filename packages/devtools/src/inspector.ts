/**
 * StreetUI DevTools — graph inspector and debug utilities.
 */

import { formatDiagnostic } from '@streetui/core';
import type { ApplicationGraph, GraphNode } from '@streetui/graph';
import type { CompiledApplication } from '@streetui/compiler';

export interface InspectedNode {
  id: string;
  type: string;
  key: string | undefined;
  props: Record<string, unknown>;
  eventTypes: string[];
  stateBindings: string[];
  children: InspectedNode[];
  depth: number;
}

export function inspectGraph(graph: ApplicationGraph): InspectedNode {
  return inspectNode(graph.root, 0);
}

function inspectNode(node: GraphNode, depth: number): InspectedNode {
  return {
    id: node.id,
    type: node.type,
    key: node.key,
    props: { ...node.props },
    eventTypes: node.events.map(e => e.type),
    stateBindings: node.stateRefs.map(r => `${r.propKey}→${r.signalId}`),
    depth,
    children: node.children.map(c => inspectNode(c, depth + 1)),
  };
}

/** Print a human-readable tree of the graph to a string. */
export function printGraph(graph: ApplicationGraph): string {
  const lines: string[] = [];
  graph.walk((node, depth) => {
    const indent = '  '.repeat(depth);
    const props = Object.entries(node.props)
      .filter(([k]) => !k.startsWith('_'))
      .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
      .join(', ');
    const events = node.events.length > 0
      ? ` [events: ${node.events.map(e => e.type).join(', ')}]`
      : '';
    const stateRefs = node.stateRefs.length > 0
      ? ` [signals: ${node.stateRefs.map(r => r.propKey).join(', ')}]`
      : '';
    lines.push(`${indent}<${node.type}${props ? ` ${props}` : ''}${events}${stateRefs}>`);
  });
  return lines.join('\n');
}

/** Print compilation diagnostics to a string. */
export function printDiagnostics(compiled: CompiledApplication): string {
  if (compiled.diagnostics.diagnostics.length === 0) {
    return '(no diagnostics)';
  }
  return compiled.diagnostics.diagnostics.map(formatDiagnostic).join('\n');
}

/** Returns node counts per type. */
export function nodeTypeStats(graph: ApplicationGraph): Record<string, number> {
  const counts: Record<string, number> = {};
  graph.walk(node => {
    counts[node.type] = (counts[node.type] ?? 0) + 1;
  });
  return counts;
}
