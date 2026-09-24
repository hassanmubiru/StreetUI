import { NodeId } from '@streetui/core';
import { ApplicationGraph } from '@streetui/graph';

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

interface NodeAnalysis {
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
interface GraphAnalysisSummary {
    readonly totalNodes: number;
    readonly staticNodes: number;
    readonly staticSubtrees: number;
    readonly dynamicTextNodes: number;
    readonly dynamicAttrNodes: number;
    readonly eventNodes: number;
    readonly lists: number;
    readonly conditionals: number;
}
interface GraphAnalysis {
    readonly nodes: ReadonlyMap<NodeId, NodeAnalysis>;
    readonly summary: GraphAnalysisSummary;
}
/**
 * Analyze a fully-built graph. O(n) single post-order pass; allocates one small
 * record per node. Safe to skip entirely when neither hydration nor diagnostics
 * need it.
 */
declare function analyzeGraph(graph: ApplicationGraph): GraphAnalysis;

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

interface InspectedCompilationNode {
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
interface CompilerInspection {
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
declare function inspectCompilation(graph: ApplicationGraph): CompilerInspection;
/** Render an inspection as a compact human-readable text report. */
declare function formatInspection(inspection: CompilerInspection): string;

export { type CompilerInspection, type GraphAnalysis, type GraphAnalysisSummary, type InspectedCompilationNode, type NodeAnalysis, analyzeGraph, formatInspection, inspectCompilation };
