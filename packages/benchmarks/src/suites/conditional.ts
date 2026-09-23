/**
 * Conditional rendering (`when()`) toggle benchmarks — flipping the driving
 * boolean signal swaps the then/else branch through the same keyed reconciler.
 */

import { bench, type BenchResult } from '../harness.js';
import { signal, type Signal } from '@streetui/state';
import { createRenderer } from '@streetui/renderer';
import type { RenderHandle } from '@streetui/runtime';
import { buildConditionalApp, compileApp } from '../apps.js';
import { freshContainer } from '../dom-env.js';

interface CondState {
  cond: Signal<boolean>;
  handle: RenderHandle;
}

export function conditionalSuite(): BenchResult[] {
  const renderer = createRenderer();
  return [
    bench<CondState>(
      'conditional/toggle',
      (state) => {
        state.cond.set(!state.cond.peek());
      },
      {
        category: 'conditional',
        n: null,
        inner: 50,
        iterations: 40,
        setup: () => {
          const cond = signal(true);
          const handle = renderer.mount(compileApp(buildConditionalApp(cond)), freshContainer());
          return { cond, handle };
        },
        teardown: (state) => state.handle.unmount(),
      },
    ),
  ];
}
