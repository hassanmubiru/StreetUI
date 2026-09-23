/**
 * Unmount / teardown benchmarks — full-tree disposal (listener + subscription
 * removal, container clearing) for flat and list-backed apps.
 */

import { bench, type BenchResult } from '../harness.js';
import { signal } from '@streetui/state';
import { createRenderer } from '@streetui/renderer';
import type { RenderHandle } from '@streetui/runtime';
import { buildFlatApp, buildListApp, compileApp, makeItems } from '../apps.js';
import { freshContainer } from '../dom-env.js';

const SIZES = [100, 1000, 5000];

export function unmountSuite(): BenchResult[] {
  const renderer = createRenderer();
  const results: BenchResult[] = [];

  for (const n of SIZES) {
    results.push(
      bench<{ handle: RenderHandle }>(
        `unmount/flat n=${n}`,
        (state) => {
          state.handle.unmount();
        },
        {
          category: 'unmount',
          n,
          iterations: n >= 1000 ? 20 : 50,
          setup: () => ({
            handle: renderer.mount(compileApp(buildFlatApp(n)), freshContainer()),
          }),
        },
      ),
    );
  }

  for (const n of SIZES) {
    results.push(
      bench<{ handle: RenderHandle }>(
        `unmount/list n=${n}`,
        (state) => {
          state.handle.unmount();
        },
        {
          category: 'unmount',
          n,
          iterations: n >= 1000 ? 20 : 50,
          setup: () => {
            const items = signal(makeItems(n));
            return { handle: renderer.mount(compileApp(buildListApp(items)), freshContainer()) };
          },
        },
      ),
    );
  }

  return results;
}
