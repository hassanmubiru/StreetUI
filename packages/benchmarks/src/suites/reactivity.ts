/**
 * Reactivity benchmarks: notifying N DOM-bound subscribers on a single signal
 * write, derived-chain recomputation, and batched writes.
 */

import { bench, type BenchResult } from '../harness.js';
import { signal, derived, batch, type Signal, type ReadonlySignal } from '@streetui/state';
import { createRenderer } from '@streetui/renderer';
import type { RenderHandle } from '@streetui/runtime';
import type { CompiledApplication } from '@streetui/compiler';
import { buildReactiveApp, compileApp } from '../apps.js';
import { freshContainer } from '../dom-env.js';

const SUBSCRIBERS = [1, 10, 100, 1000];
const CHAIN_DEPTHS = [10, 100, 500];

interface ReactiveState {
  sig: Signal<string>;
  handle: RenderHandle;
  toggle: boolean;
}

export function reactivitySuite(): BenchResult[] {
  const results: BenchResult[] = [];
  const renderer = createRenderer();

  // Signal write propagated to N text-node subscribers (real DOM patch each).
  for (const n of SUBSCRIBERS) {
    results.push(
      bench<ReactiveState>(
        `reactivity/update-subscribers n=${n}`,
        (state) => {
          state.toggle = !state.toggle;
          state.sig.set(state.toggle ? 'a' : 'b');
        },
        {
          category: 'reactivity',
          n,
          inner: 10,
          iterations: 40,
          setup: () => {
            const { app, sig } = buildReactiveApp(n);
            const compiled: CompiledApplication = compileApp(app);
            const handle = renderer.mount(compiled, freshContainer());
            return { sig, handle, toggle: false };
          },
          teardown: (state) => state.handle.unmount(),
        },
      ),
    );
  }

  // Derived-chain recompute: root → d chained derived signals; measure the cost
  // of one root write forcing the whole chain to recompute and read the tail.
  for (const depth of CHAIN_DEPTHS) {
    results.push(
      bench<{ root: Signal<number>; tail: ReadonlySignal<number>; i: number }>(
        `reactivity/derived-chain depth=${depth}`,
        (state) => {
          state.i++;
          state.root.set(state.i);
          state.tail.get();
        },
        {
          category: 'reactivity',
          n: depth,
          inner: 50,
          iterations: 40,
          setup: () => {
            const root = signal(0);
            let cur: ReadonlySignal<number> = root;
            for (let d = 0; d < depth; d++) {
              const prev = cur;
              cur = derived(() => prev.get() + 1);
            }
            // Prime the chain once so the first measured read isn't cold.
            cur.get();
            return { root, tail: cur, i: 0 };
          },
        },
      ),
    );
  }

  // batch(): many writes to distinct signals inside one batch → one flush.
  for (const n of [10, 100, 1000]) {
    results.push(
      bench<Signal<number>[]>(
        `reactivity/batch-writes n=${n}`,
        (sigs) => {
          batch(() => {
            for (let i = 0; i < sigs.length; i++) (sigs[i] as Signal<number>).update((v) => v + 1);
          });
        },
        {
          category: 'reactivity',
          n,
          inner: 20,
          iterations: 40,
          setup: () => {
            const sigs: Signal<number>[] = [];
            for (let i = 0; i < n; i++) sigs.push(signal(0));
            return sigs;
          },
        },
      ),
    );
  }

  return results;
}
