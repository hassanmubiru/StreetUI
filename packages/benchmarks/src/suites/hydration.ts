/**
 * Hydration benchmarks — adopt server-rendered markup with `renderer.hydrate`
 * across sizes. Each sample compiles a fresh app, produces its SSR HTML, seeds
 * a container with it (all untimed), then measures the adopt-and-wire pass.
 */

import { bench, type BenchResult } from '../harness.js';
import { createRenderer, renderToString } from '@streetui/renderer';
import type { CompiledApplication } from '@streetui/compiler';
import type { RenderHandle } from '@streetui/runtime';
import { buildFlatApp, compileApp } from '../apps.js';
import { freshContainer } from '../dom-env.js';

const SIZES = [10, 100, 1000, 5000];

interface HydrateState {
  compiled: CompiledApplication;
  container: Element;
  handle?: RenderHandle;
}

export function hydrationSuite(): BenchResult[] {
  const results: BenchResult[] = [];
  const renderer = createRenderer();

  for (const n of SIZES) {
    results.push(
      bench<HydrateState>(
        `hydration/hydrate n=${n}`,
        (state) => {
          state.handle = renderer.hydrate(state.compiled, state.container);
        },
        {
          category: 'hydration',
          n,
          iterations: n >= 1000 ? 20 : 50,
          setup: () => {
            const compiled = compileApp(buildFlatApp(n));
            const html = renderToString(compiled);
            const container = freshContainer();
            container.innerHTML = html;
            return { compiled, container };
          },
          teardown: (state) => state.handle?.unmount(),
        },
      ),
    );
  }

  return results;
}
