/**
 * Public surface of the benchmark package — the harness, comparison, app
 * builders, reporting helpers, and the suite aggregator. Imported by the
 * runnable entry (`run.ts`) and by the harness correctness tests.
 */

export * from './harness.js';
export * from './compare.js';
export * from './report.js';
export * from './apps.js';
export { installHappyDom, freshContainer } from './dom-env.js';

import { environment, type BenchResult, type BenchSuiteResult } from './harness.js';
import { compilerSuite } from './suites/compiler.js';
import { renderSuite } from './suites/render.js';
import { reactivitySuite } from './suites/reactivity.js';
import { listsSuite } from './suites/lists.js';
import { attributesSuite } from './suites/attributes.js';
import { eventsSuite } from './suites/events.js';
import { conditionalSuite } from './suites/conditional.js';
import { unmountSuite } from './suites/unmount.js';
import { ssrSuite } from './suites/ssr.js';
import { hydrationSuite } from './suites/hydration.js';

export interface SuiteDef {
  readonly name: string;
  readonly run: () => BenchResult[];
}

export const SUITES: readonly SuiteDef[] = [
  { name: 'compiler', run: compilerSuite },
  { name: 'render', run: renderSuite },
  { name: 'reactivity', run: reactivitySuite },
  { name: 'conditional', run: conditionalSuite },
  { name: 'keyed-lists', run: listsSuite },
  { name: 'attributes', run: attributesSuite },
  { name: 'events', run: eventsSuite },
  { name: 'unmount', run: unmountSuite },
  { name: 'ssr', run: ssrSuite },
  { name: 'hydration', run: hydrationSuite },
];

/**
 * Run every suite (or a filtered subset) and return the aggregated result with
 * a captured environment header. `onSuite` is an optional progress hook.
 */
export function runAllSuites(options: {
  filter?: readonly string[];
  onSuite?: (name: string) => void;
} = {}): BenchSuiteResult {
  const filter = options.filter;
  const results: BenchResult[] = [];
  for (const suite of SUITES) {
    if (filter !== undefined && filter.length > 0 && !filter.includes(suite.name)) continue;
    options.onSuite?.(suite.name);
    results.push(...suite.run());
  }
  return { environment: environment(), results };
}
