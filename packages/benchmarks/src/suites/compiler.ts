/**
 * Compiler / DSL construction benchmarks: building the DSL graph and running
 * `compile()` (validate + transform) across representative node counts.
 */

import { bench, type BenchResult } from '../harness.js';
import { buildFlatApp, compileApp } from '../apps.js';

const SIZES = [10, 100, 1000, 5000];

export function compilerSuite(): BenchResult[] {
  const results: BenchResult[] = [];

  // DSL build only (graph construction, no validation/transform).
  for (const n of SIZES) {
    results.push(
      bench(
        `compiler/dsl-build n=${n}`,
        () => {
          buildFlatApp(n);
        },
        { category: 'compiler', n, iterations: n >= 1000 ? 25 : 60 },
      ),
    );
  }

  // Full compile: build + validate + transform.
  for (const n of SIZES) {
    results.push(
      bench(
        `compiler/compile n=${n}`,
        (app) => {
          compileApp(app);
        },
        {
          category: 'compiler',
          n,
          iterations: n >= 1000 ? 25 : 60,
          setup: () => buildFlatApp(n),
        },
      ),
    );
  }

  return results;
}
