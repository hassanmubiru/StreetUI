import { ApplicationGraph } from '@streetui/graph';
import { CompiledApplication } from '@streetui/compiler';

/**
 * StreetUI DevTools — graph inspector and debug utilities.
 */

interface InspectedNode {
    id: string;
    type: string;
    key: string | undefined;
    props: Record<string, unknown>;
    eventTypes: string[];
    stateBindings: string[];
    children: InspectedNode[];
    depth: number;
}
declare function inspectGraph(graph: ApplicationGraph): InspectedNode;
/** Print a human-readable tree of the graph to a string. */
declare function printGraph(graph: ApplicationGraph): string;
/** Print compilation diagnostics to a string. */
declare function printDiagnostics(compiled: CompiledApplication): string;
/** Returns node counts per type. */
declare function nodeTypeStats(graph: ApplicationGraph): Record<string, number>;

export { type InspectedNode, inspectGraph, nodeTypeStats, printDiagnostics, printGraph };
