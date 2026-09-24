import { DiagnosticCollector } from '@streetui/core';
import { ApplicationGraph } from '@streetui/graph';
import { StreetApp } from '@streetui/dsl';

/**
 * StreetUI compiler entry point.
 *
 * Pipeline:
 *   StreetApp (DSL)
 *     → ApplicationGraph (build)
 *     → validate
 *     → transform
 *     → CompiledApplication
 */

interface CompiledApplication {
    /** The fully built, validated, and transformed graph. */
    readonly graph: ApplicationGraph;
    /** Diagnostics accumulated during compilation. */
    readonly diagnostics: DiagnosticCollector;
    /** Metadata */
    readonly name: string;
    readonly version: string;
    readonly compiledAt: number;
}
interface CompileOptions {
    /** If true, compilation throws on errors. Defaults to true. */
    readonly strict?: boolean;
    /** If true, also throw on warnings. Defaults to false. */
    readonly strictWarnings?: boolean;
}
/**
 * Compile a StreetApp DSL definition into a CompiledApplication
 * ready for the runtime to execute.
 */
declare function compile(app: StreetApp, options?: CompileOptions): CompiledApplication;
/**
 * Compile from a pre-built ApplicationGraph (used when the graph
 * was constructed programmatically rather than through the DSL).
 */
declare function compileGraph(graph: ApplicationGraph, options?: CompileOptions): CompiledApplication;

/**
 * Compiler-phase validation of the ApplicationGraph.
 *
 * This runs after the DSL has built the graph but before the runtime
 * receives a CompiledApplication. More checks live here than in the
 * graph's own validate() because the compiler has broader context.
 */

declare function validateGraph(graph: ApplicationGraph): DiagnosticCollector;

/**
 * Graph transformation pass.
 *
 * After validation, the transformer prepares the graph for the runtime by:
 *  - Resolving implicit defaults (e.g. heading level defaults to 1)
 *  - Normalizing prop names
 *  - Assigning deterministic render keys where missing
 *  - Flattening / hoisting where beneficial
 */

declare function transformGraph(graph: ApplicationGraph): void;

export { type CompileOptions, type CompiledApplication, compile, compileGraph, transformGraph, validateGraph };
