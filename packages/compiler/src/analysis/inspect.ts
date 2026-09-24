/**
 * Diagnostic compiler-inspection mode (v1.2, spec §14).
 *
 * Produces a machine-readable (and optionally text-formatted) description of
 * what the compiler understands about an application: which nodes are static
 * vs dynamic, which carry dynamic text or attributes, which wire events, and
 * which are conditional regions or keyed lists — plus the hydration metadata
 * derived from that classification.
 *
 * This is a DIAGNOSTIC tool. It is not part of the runtime, is not consulted
 * during mount, and is tree-shakeable out of any app that never calls it.
 */

import type { ApplicationGraph, GraphNode } from '@streetui/graph';
import { analyzeGraph, type GraphAnalysisSummary } from './analyze.js';

export interface InspectedCompilationNode {
  readonly id: string;
  readonly type: string;
  readonly depth: number;
  readonly classification: 'static' | 'static-subtree-root' | 'dynamic';
  readonly dynamicText: boolean;
  readonly dynamicAttrs: boolean;
  readonly events: readonly string[];
  readonly boundProps: readonly string[];
  readonly isList: boolean;
  readonly isConditional: boolean;
  /** Hydration hint: how the hydration path should treat this node. */
  readonly hydration: 'adopt-static' | 'verify-dynamic';
}

export interface CompilerInspection {
  readonly name: string;
  readonly version: string;
  readonly summary: GraphAnalysisSummary & {
    /** Fraction of nodes provably static (0..1). */
    readonly staticRatio: number;
  };
  readonly nodes: readonly InspectedCompilationNode[];
}

/**
 * Inspect a compiled/built graph and return a structured diagnostic report.
 * Purely observational — never mutates the graph.
 */
export function inspectCompilation(graph: ApplicationGraph): CompilerInspection {
  const analysis = analyzeGraph(graph);
  const nodes: InspectedCompilationNode[] = [];

  const walk = (node: GraphNode, depth: number): void => {
    const a = analysis.nodes.get(node.id);
    if (a !== undefined) {
      const classification: InspectedCompilationNode['classification'] = a.isStaticSubtree
        ? 'static-subtree-root'
        : a.isStatic
          ? 'static'
          : 'dynamic';
      nodes.push({
        id: node.id,
        type: node.type,
        depth,
        classification,
        dynamicText: a.hasDynamicText,
        dynamicAttrs: a.hasDynamicAttr,
        events: node.events.map((e) => e.type),
        boundProps: node.stateRefs.map((r) => r.propKey),
        isList: a.isList,
        isConditional: a.isConditional,
        hydration: a.isStaticSubtree ? 'adopt-static' : 'verify-dynamic',
      });
    }
    for (const child of node.children) walk(child, depth + 1);
  };
  walk(graph.root, 0);

  const staticRatio =
    analysis.summary.totalNodes === 0
      ? 0
      : analysis.summary.staticNodes / analysis.summary.totalNodes;

  return {
    name: graph.name,
    version: graph.version,
    summary: { ...analysis.summary, staticRatio: +staticRatio.toFixed(4) },
    nodes,
  };
}

/** Render an inspection as a compact human-readable text report. */
export function formatInspection(inspection: CompilerInspection): string {
  const s = inspection.summary;
  const lines: string[] = [];
  lines.push(`StreetUI compiler inspection — ${inspection.name} v${inspection.version}`);
  lines.push(
    `  nodes=${s.totalNodes} static=${s.staticNodes} ` +
      `staticSubtrees=${s.staticSubtrees} dynamicText=${s.dynamicTextNodes} ` +
      `dynamicAttrs=${s.dynamicAttrNodes} events=${s.eventNodes} ` +
      `lists=${s.lists} conditionals=${s.conditionals} ` +
      `staticRatio=${(s.staticRatio * 100).toFixed(1)}%`,
  );
  for (const n of inspection.nodes) {
    const flags: string[] = [];
    if (n.dynamicText) flags.push('text');
    if (n.dynamicAttrs) flags.push('attr:' + n.boundProps.join(','));
    if (n.events.length > 0) flags.push('on:' + n.events.join(','));
    if (n.isList) flags.push('list');
    if (n.isConditional) flags.push('cond');
    lines.push(
      `  ${'  '.repeat(n.depth)}${n.type}#${n.id} [${n.classification}]` +
        (flags.length > 0 ? ` {${flags.join(' ')}}` : ''),
    );
  }
  return lines.join('\n');
}
