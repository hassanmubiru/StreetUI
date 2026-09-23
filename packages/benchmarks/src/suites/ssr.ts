/**
 * SSR benchmarks — `renderToString` over the ServerDOMAdapter across sizes.
 * (No streaming SSR in v0.7 — single-pass full-document serialization only.)
 */

import { bench, type BenchResult } from '../harness.js';
import { renderToString } from '@streetui/renderer';
import type { CompiledApplication } from '@streetui/compiler';
import { buildFlatApp, compileApp } from '../apps.js';

const SIZES = [10, 100, 1000, 5000];

export function ssrSuite(): BenchResult[] {
  const results: BenchResult[] = [];
  for (const n of SIZES) {
    results.push(
      bench<CompiledApplication>(
        `ssr/render-to-string n=${n}`,
        (compiled) => {
          renderToString(compiled);
        },
        {
          category: 'ssr',
          n,
          iterations: n >= 1000 ? 25 : 60,
          setup: () => compileApp(buildFlatApp(n)),
        },
      ),
    );
  }
  return results;
}
