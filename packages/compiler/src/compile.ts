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

import { DiagnosticCollector } from '@streetui/core';
import { type ApplicationGraph } from '@streetui/graph';
import { type StreetApp } from '@streetui/dsl';
import { validateGraph } from './validation/validator.js';
import { transformGraph } from './transform/transform.js';

export interface CompiledApplication {
  /** The fully built, validated, and transformed graph. */
  readonly graph: ApplicationGraph;
  /** Diagnostics accumulated during compilation. */
  readonly diagnostics: DiagnosticCollector;
  /** Metadata */
  readonly name: string;
  readonly version: string;
  readonly compiledAt: number;
}

export interface CompileOptions {
  /** If true, compilation throws on errors. Defaults to true. */
  readonly strict?: boolean;
  /** If true, also throw on warnings. Defaults to false. */
  readonly strictWarnings?: boolean;
}

/**
 * Compile a StreetApp DSL definition into a CompiledApplication
 * ready for the runtime to execute.
 */
export function compile(
  app: StreetApp,
  options: CompileOptions = {},
): CompiledApplication {
  const strict = options.strict ?? true;
  const strictWarnings = options.strictWarnings ?? false;
  const dc = new DiagnosticCollector();

  // 1. Build the graph from the DSL
  const graph = app.graph;

  // 2. Validate
  const validationDc = validateGraph(graph);
  dc.merge(validationDc);

  if (strict && dc.hasErrors) {
    dc.throwIfErrors();
  }
  if (strictWarnings && dc.hasWarnings) {
    throw new Error(
      `[StreetUI Compiler] Compilation failed: warnings treated as errors.\n` +
        dc.diagnostics
          .filter(d => d.severity === 'warning')
          .map(d => `  [${d.code}] ${d.message}`)
          .join('\n'),
    );
  }

  // 3. Transform
  transformGraph(graph);

  return {
    graph,
    diagnostics: dc,
    name: graph.name,
    version: graph.version,
    compiledAt: Date.now(),
  };
}

/**
 * Compile from a pre-built ApplicationGraph (used when the graph
 * was constructed programmatically rather than through the DSL).
 */
export function compileGraph(
  graph: ApplicationGraph,
  options: CompileOptions = {},
): CompiledApplication {
  const strict = options.strict ?? true;
  const dc = new DiagnosticCollector();

  const validationDc = validateGraph(graph);
  dc.merge(validationDc);

  if (strict && dc.hasErrors) {
    dc.throwIfErrors();
  }

  transformGraph(graph);

  return {
    graph,
    diagnostics: dc,
    name: graph.name,
    version: graph.version,
    compiledAt: Date.now(),
  };
}
