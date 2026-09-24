// DEV-ONLY benchmark artifact — Svelte 5 in-browser scenario runner. NOT part of the `streetui` runtime.
/**
 * Svelte 5 browser scenarios A, B, C, D, E, G. Runs in Chromium (Playwright via
 * the Vite preview server). Results match `benchmarks/results/baseline.json`.
 *
 * Fairness notes:
 *   - Reactive state lives in the shared `$state` store (store.svelte.js);
 *     updates are flushed with Svelte's `tick()` before the clock stops, so we
 *     measure to committed DOM (same contract as StreetUI's scheduler).
 *   - Because all instances share one reactive store, each scenario unmounts the
 *     previous instance before mounting a fresh one, so a mutation only drives
 *     the single instance being measured (no cross-iteration fan-out inflation).
 *   - Mutations counted via MutationObserver drained with `takeRecords()`.
 */

import { mount, unmount, hydrate, tick } from 'svelte';
import { render } from 'svelte/server';
import Flat from './Flat.svelte';
import OneBound from './OneBound.svelte';
import FanOut from './FanOut.svelte';
import List from './List.svelte';
import Deep from './Deep.svelte';
import { store } from './store.svelte.js';
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

const freshUser = () => ({
  profile: { name: 'Ada' },
  preferences: { theme: 'dark' },
  permissions: { admin: false },
  activity: { lastSeen: 0, streak: 0 },
});

export async function runBrowserScenarios() {
  const benchmarks = {};

  // A — Initial render of 10,000 rows. Flat reads no shared state, so accumulated
  // instances cannot react to anything — no unmount needed (matches React/Vue A).
  {
    let created = 0;
    const timing = await measure(
      (s) => {
        mount(Flat, { target: s.container, props: { n: N_BIG } });
        created = countDomNodes(s.container);
      },
      {
        iterations: 15,
        warmup: 4,
        setup: () => ({ container: makeContainer() }),
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
    let inst = null;
    const timing = await measure(
      async (s) => {
        s.counter.start();
        toggle = !toggle;
        store.live = toggle ? 'A' : 'B';
        await tick();
        mutations = s.counter.stop().total;
      },
      {
        iterations: 40,
        warmup: 8,
        setup: () => {
          if (inst) unmount(inst);
          store.live = 'init';
          const container = makeContainer();
          inst = mount(OneBound, { target: container, props: { n: N_BIG } });
          return { counter: createMutationCounter(container) };
        },
      },
    );
    if (inst) unmount(inst);
    benchmarks.B_singleUpdate = {
      nodes: N_BIG,
      ...timing,
      domMutations: mutations,
      note: 'one $state write in a 10k tree; domMutations MUST be 1 (fine-grained)',
    };
  }

  // C — Large keyed list (10,000 items).
  {
    const list = {};
    for (const op of LIST_OPS) {
      const transform = LIST_TRANSFORMS[op];
      let created = 0;
      let removed = 0;
      let inst = null;
      const timing = await measure(
        async (s) => {
          s.counter.start();
          store.items = s.target;
          await tick();
          const c = s.counter.stop();
          created = c.added;
          removed = c.removed;
        },
        {
          iterations: 12,
          warmup: 3,
          setup: () => {
            if (inst) unmount(inst);
            const base = makeItems(N_BIG);
            store.items = base;
            const container = makeContainer();
            inst = mount(List, { target: container });
            return { counter: createMutationCounter(container), target: transform(base, N_BIG) };
          },
        },
      );
      if (inst) unmount(inst);
      list[op] = { items: N_BIG, ...timing, domNodesCreated: created, domNodesRemoved: removed };
    }
    benchmarks.C_largeList = list;
  }

  // D — Reactive fan-out (1 $state → 1,000 / 10,000 cells).
  {
    const fan = {};
    for (const n of FANOUT_SIZES) {
      let mutations = 0;
      let toggle = false;
      let inst = null;
      const timing = await measure(
        async (s) => {
          s.counter.start();
          toggle = !toggle;
          store.val = toggle ? 'x' : 'y';
          await tick();
          mutations = s.counter.stop().total;
        },
        {
          iterations: 25,
          warmup: 6,
          setup: () => {
            if (inst) unmount(inst);
            store.val = 'init';
            const container = makeContainer();
            inst = mount(FanOut, { target: container, props: { n } });
            return { counter: createMutationCounter(container) };
          },
        },
      );
      if (inst) unmount(inst);
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
    let inst = null;
    const timing = await measure(
      async (s) => {
        s.counter.start();
        n = (n + 1) % 1000;
        store.user.activity.lastSeen = n;
        store.user.activity.streak = n;
        await tick();
        mutations = s.counter.stop().total;
      },
      {
        iterations: 40,
        warmup: 8,
        setup: () => {
          if (inst) unmount(inst);
          store.user = freshUser();
          const container = makeContainer();
          inst = mount(Deep, { target: container });
          return { counter: createMutationCounter(container) };
        },
      },
    );
    if (inst) unmount(inst);
    benchmarks.E_deepState = {
      leaves: 4,
      ...timing,
      nodesUpdated: mutations,
      note: 'update one deep branch; nodesUpdated MUST be 1 of 4 leaves (fine-grained)',
    };
  }

  // G — Hydration: adopt server markup for the 10k tree.
  {
    const { html } = render(Flat, { props: { n: N_BIG } });
    let created = 0;
    let inst = null;
    const timing = await measure(
      (s) => {
        s.counter.start();
        inst = hydrate(Flat, { target: s.container, props: { n: N_BIG } });
        created = s.counter.stop().added;
      },
      {
        iterations: 15,
        warmup: 4,
        setup: () => {
          if (inst) unmount(inst);
          const container = makeContainer();
          container.innerHTML = html;
          return { container, counter: createMutationCounter(container) };
        },
      },
    );
    if (inst) unmount(inst);
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
