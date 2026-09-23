/**
 * Initial-render (mount) benchmarks — the full `renderer.mount` DOM-creation
 * walk across representative tree sizes, using the real BrowserDOMAdapter over
 * happy-dom.
 */

import { bench, type BenchResult } from '../harness.js';
import { createRenderer } from '@streetui/renderer';
import type { CompiledApplication } from '@streetui/compiler';
import type { RenderHandle } from '@streetui/runtime';
import { buildFlatApp, compileApp } from '../apps.js';
import { freshContainer } from '../dom-env.js';

const SIZES = [10, 100, 1000, 5000];

interface MountState {
  compiled: CompiledApplication;
  container: Element;
  handle?: RenderHandle;
}

export function renderSuite(): BenchResult[] {
  const results: BenchResult[] = [];
  const renderer = createRenderer();

  for (const n of SIZES) {
    results.push(
      bench<MountState>(
        `render/mount n=${n}`,
        (state) => {
          state.handle = renderer.mount(state.compiled, state.container);
        },
        {
          category: 'render',
          n,
          iterations: n >= 1000 ? 20 : 50,
          setup: () => ({
            compiled: compileApp(buildFlatApp(n)),
            container: freshContainer(),
          }),
          teardown: (state) => state.handle?.unmount(),
        },
      ),
    );
  }

  return results;
}
