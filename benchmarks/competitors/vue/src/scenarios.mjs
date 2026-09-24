// DEV-ONLY benchmark artifact — Vue 3.5 in-browser scenario runner. NOT part of the `streetui` runtime.
/**
 * Vue 3.5 browser scenarios A, B, C, D, E, G. Runs in Chromium (Playwright via
 * the Vite preview server). Results match `benchmarks/results/baseline.json`.
 *
 * Fairness notes:
 *   - Vue commits reactive updates on the next microtask, so each timed update
 *     awaits `nextTick()` — the measurement therefore ends when the DOM is
 *     actually committed, the same contract StreetUI's synchronous scheduler
 *     provides. `await measure(...)` (shared helper) supports this.
 *   - Mutations counted via MutationObserver drained with `takeRecords()`.
 */

import { createApp, createSSRApp, nextTick } from 'vue';
import { renderToString } from '@vue/server-renderer';
import {
  measure,
  countDomNodes,
  createMutationCounter,
  makeContainer,
  N_BIG,
  FANOUT_SIZES,
  LIST_OPS,
  LIST_TRANSFORMS,
  makeItems,
} from '../../shared/measure.mjs';
import { makeFlat, makeOneBound, makeFanOut, makeList, makeDeep } from './app.mjs';

export async function runBrowserScenarios() {
  const benchmarks = {};

  // A — Initial render of 10,000 rows.
  {
    let created = 0;
    const timing = await measure(
      (s) => {
        s.app.mount(s.container);
        created = countDomNodes(s.container);
      },
      {
        iterations: 15,
        warmup: 4,
        setup: () => {
          const container = makeContainer();
          return { container, app: createApp(makeFlat(N_BIG).App) };
        },
      },
    );
    benchmarks.A_initialRender = {
      nodes: N_BIG,
      ...timing,
      domNodesCreated: created,
      note: 'time to create DOM; synchronous mount == interactive',
    };
  }

  // B — One reactive update in a 10,000-node tree.
  {
    let mutations = 0;
    let toggle = false;
    const timing = await measure(
      async (s) => {
        s.counter.start();
        toggle = !toggle;
        s.live.value = toggle ? 'A' : 'B';
        await nextTick();
        mutations = s.counter.stop().total;
      },
      {
        iterations: 40,
        warmup: 8,
        setup: () => {
          const container = makeContainer();
          const { App, live } = makeOneBound(N_BIG);
          createApp(App).mount(container);
          return { live, counter: createMutationCounter(container) };
        },
      },
    );
    benchmarks.B_singleUpdate = {
      nodes: N_BIG,
      ...timing,
      domMutations: mutations,
      note: 'one ref write in a 10k tree; domMutations MUST be 1 (targeted, no subtree re-render)',
    };
  }

  // C — Large keyed list (10,000 items).
  {
    const list = {};
    for (const op of LIST_OPS) {
      const transform = LIST_TRANSFORMS[op];
      let created = 0;
      let removed = 0;
      const timing = await measure(
        async (s) => {
          s.counter.start();
          s.items.value = s.target;
          await nextTick();
          const c = s.counter.stop();
          created = c.added;
          removed = c.removed;
        },
        {
          iterations: 12,
          warmup: 3,
          setup: () => {
            const container = makeContainer();
            const base = makeItems(N_BIG);
            const { App, items } = makeList(base);
            createApp(App).mount(container);
            return { items, counter: createMutationCounter(container), target: transform(base, N_BIG) };
          },
        },
      );
      list[op] = { items: N_BIG, ...timing, domNodesCreated: created, domNodesRemoved: removed };
    }
    benchmarks.C_largeList = list;
  }

  // D — Reactive fan-out (1 ref → 1,000 / 10,000 cells).
  {
    const fan = {};
    for (const n of FANOUT_SIZES) {
      let mutations = 0;
      let toggle = false;
      const timing = await measure(
        async (s) => {
          s.counter.start();
          toggle = !toggle;
          s.val.value = toggle ? 'x' : 'y';
          await nextTick();
          mutations = s.counter.stop().total;
        },
        {
          iterations: 25,
          warmup: 6,
          setup: () => {
            const container = makeContainer();
            const { App, val } = makeFanOut(n);
            createApp(App).mount(container);
            return { val, counter: createMutationCounter(container) };
          },
        },
      );
      fan['subscribers=' + n] = {
        subscribers: n,
        ...timing,
        domMutations: mutations,
        note: 'one write updates exactly `subscribers` text nodes; no wasted computation',
      };
    }
    benchmarks.D_fanOut = fan;
  }

  // E — Deep reactive state: update ONE nested branch.
  {
    let mutations = 0;
    let n = 0;
    const timing = await measure(
      async (s) => {
        s.counter.start();
        n = (n + 1) % 1000;
        s.user.activity.lastSeen = n;
        s.user.activity.streak = n;
        await nextTick();
        mutations = s.counter.stop().total;
      },
      {
        iterations: 40,
        warmup: 8,
        setup: () => {
          const container = makeContainer();
          const { App, user } = makeDeep();
          createApp(App).mount(container);
          return { user, counter: createMutationCounter(container) };
        },
      },
    );
    benchmarks.E_deepState = {
      leaves: 4,
      ...timing,
      nodesUpdated: mutations,
      note: 'update one deep branch; nodesUpdated MUST be 1 of 4 leaves (Vue diffs to the one text node)',
    };
  }

  // G — Hydration: adopt server markup for the 10k tree with createSSRApp.
  {
    const html = await renderToString(createSSRApp(makeFlat(N_BIG).App));
    let created = 0;
    const timing = await measure(
      (s) => {
        s.counter.start();
        createSSRApp(makeFlat(N_BIG).App).mount(s.container);
        created = s.counter.stop().added;
      },
      {
        iterations: 15,
        warmup: 4,
        setup: () => {
          const container = makeContainer();
          container.innerHTML = html;
          return { container, counter: createMutationCounter(container) };
        },
      },
    );
    benchmarks.G_hydration = {
      nodes: N_BIG,
      ...timing,
      domNodesCreatedDuringHydration: created,
      environment: 'chromium (Playwright)',
      note: 'adopts server DOM; domNodesCreatedDuringHydration should be ~0 for a matching tree',
    };
  }

  return benchmarks;
}
