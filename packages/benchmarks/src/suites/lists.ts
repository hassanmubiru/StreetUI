/**
 * Keyed-list reconciliation benchmarks — the core reconciler under append,
 * prepend, remove, insert, move, reverse, and full-replace transitions.
 *
 * Each sample mounts a list of the base size (untimed setup), then performs a
 * single A→B transition by writing the items signal (the measured work is the
 * synchronous keyed reconcile + DOM mutation), then unmounts (untimed teardown).
 */

import { bench, type BenchResult } from '../harness.js';
import { signal, type Signal } from '@streetui/state';
import { createRenderer } from '@streetui/renderer';
import type { RenderHandle } from '@streetui/runtime';
import { buildListApp, compileApp, makeItems, type ListItem } from '../apps.js';
import { freshContainer } from '../dom-env.js';

const SIZES = [10, 100, 1000, 5000];

interface ListState {
  items: Signal<ListItem[]>;
  handle: RenderHandle;
  target: ListItem[];
}

type Transition = (base: ListItem[], n: number) => ListItem[];

const TRANSITIONS: Record<string, Transition> = {
  append: (base, n) => [...base, ...makeItems(1, n)],
  prepend: (base, n) => [...makeItems(1, n), ...base],
  'remove-last': (base) => base.slice(0, base.length - 1),
  'remove-first': (base) => base.slice(1),
  'insert-middle': (base, n) => {
    const mid = Math.floor(base.length / 2);
    return [...base.slice(0, mid), ...makeItems(1, n), ...base.slice(mid)];
  },
  move: (base) => {
    if (base.length < 2) return [...base];
    const copy = [...base];
    const first = copy[0] as ListItem;
    const last = copy[copy.length - 1] as ListItem;
    copy[0] = last;
    copy[copy.length - 1] = first;
    return copy;
  },
  reverse: (base) => [...base].reverse(),
  'replace-all': (base, n) => makeItems(base.length, n * 10),
};

function iterationsFor(n: number): number {
  if (n >= 5000) return 15;
  if (n >= 1000) return 20;
  return 40;
}
function warmupFor(n: number): number {
  return n >= 1000 ? 3 : 6;
}

export function listsSuite(): BenchResult[] {
  const results: BenchResult[] = [];
  const renderer = createRenderer();

  for (const [op, transition] of Object.entries(TRANSITIONS)) {
    for (const n of SIZES) {
      results.push(
        bench<ListState>(
          `lists/${op} n=${n}`,
          (state) => {
            state.items.set(state.target);
          },
          {
            category: 'keyed-lists',
            n,
            iterations: iterationsFor(n),
            warmup: warmupFor(n),
            setup: () => {
              const base = makeItems(n);
              const items = signal(base);
              const handle = renderer.mount(compileApp(buildListApp(items)), freshContainer());
              return { items, handle, target: transition(base, n) };
            },
            teardown: (state) => state.handle.unmount(),
          },
        ),
      );
    }
  }

  return results;
}
