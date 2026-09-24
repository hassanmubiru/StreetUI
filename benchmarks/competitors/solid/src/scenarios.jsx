// DEV-ONLY benchmark artifact — Solid 1.9 in-browser scenario runner. NOT part of the `streetui` runtime.
/**
 * Solid 1.9 browser scenarios A, B, C, D, E, G. Runs in Chromium (Playwright via
 * the Vite preview server). Results match `benchmarks/results/baseline.json`.
 *
 * Fairness notes:
 *   - Solid commits updates synchronously and fine-grained, so a setter call is
 *     immediately reflected in the DOM — no tick/flush needed (same "measure to
 *     committed DOM" contract as StreetUI's synchronous scheduler).
 *   - Each scenario creates its own signals/store and disposes the previous
 *     render, so an update drives only the instance being measured.
 *   - Mutations counted via MutationObserver drained with `takeRecords()`.
 *   - Scenario G requires server markup produced by Solid's SSR build (the
 *     client build cannot server-render); the orchestrator injects it as
 *     `globalThis.__SOLID_SSR_HTML__`. If absent (standalone run) G is skipped
 *     honestly rather than faked.
 */

import { createSignal } from 'solid-js';
import { createStore } from 'solid-js/store';
import { render, hydrate } from 'solid-js/web';
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
import { FlatList, OneBound, FanOut, KeyedList, DeepState } from './app.jsx';

const freshUser = () => ({
  profile: { name: 'Ada' },
  preferences: { theme: 'dark' },
  permissions: { admin: false },
  activity: { lastSeen: 0, streak: 0 },
});

export async function runBrowserScenarios() {
  const benchmarks = {};

  // A — Initial render of 10,000 rows.
  {
    let created = 0;
    let dispose = null;
    const timing = await measure(
      (s) => {
        s.dispose = render(() => <FlatList n={N_BIG} />, s.container);
        created = countDomNodes(s.container);
      },
      {
        iterations: 15,
        warmup: 4,
        setup: () => {
          if (dispose) dispose();
          const container = makeContainer();
          const s = { container };
          // capture dispose for the NEXT setup to clean up
          Promise.resolve().then(() => (dispose = s.dispose));
          return s;
        },
      },
    );
    if (dispose) dispose();
    benchmarks.A_initialRender = {
      nodes: N_BIG,
      ...timing,
      domNodesCreated: created,
      note: 'time to create DOM; synchronous render == interactive',
    };
  }

  // B — One reactive update in a 10,000-node tree.
  {
    let mutations = 0;
    let toggle = false;
    let dispose = null;
    const timing = await measure(
      (s) => {
        s.counter.start();
        toggle = !toggle;
        s.setLive(toggle ? 'A' : 'B');
        mutations = s.counter.stop().total;
      },
      {
        iterations: 40,
        warmup: 8,
        setup: () => {
          if (dispose) dispose();
          const container = makeContainer();
          const [live, setLive] = createSignal('init');
          dispose = render(() => <OneBound n={N_BIG} live={live} />, container);
          return { setLive, counter: createMutationCounter(container) };
        },
      },
    );
    if (dispose) dispose();
    benchmarks.B_singleUpdate = {
      nodes: N_BIG,
      ...timing,
      domMutations: mutations,
      note: 'one signal write in a 10k tree; domMutations MUST be 1 (fine-grained)',
    };
  }

  // C — Large keyed list (10,000 items).
  {
    const list = {};
    for (const op of LIST_OPS) {
      const transform = LIST_TRANSFORMS[op];
      let created = 0;
      let removed = 0;
      let dispose = null;
      const timing = await measure(
        (s) => {
          s.counter.start();
          s.setItems(s.target);
          const c = s.counter.stop();
          created = c.added;
          removed = c.removed;
        },
        {
          iterations: 12,
          warmup: 3,
          setup: () => {
            if (dispose) dispose();
            const container = makeContainer();
            const base = makeItems(N_BIG);
            const [items, setItems] = createSignal(base);
            dispose = render(() => <KeyedList items={items} />, container);
            return { setItems, counter: createMutationCounter(container), target: transform(base, N_BIG) };
          },
        },
      );
      if (dispose) dispose();
      list[op] = { items: N_BIG, ...timing, domNodesCreated: created, domNodesRemoved: removed };
    }
    benchmarks.C_largeList = list;
  }

  // D — Reactive fan-out (1 signal → 1,000 / 10,000 cells).
  {
    const fan = {};
    for (const n of FANOUT_SIZES) {
      let mutations = 0;
      let toggle = false;
      let dispose = null;
      const timing = await measure(
        (s) => {
          s.counter.start();
          toggle = !toggle;
          s.setVal(toggle ? 'x' : 'y');
          mutations = s.counter.stop().total;
        },
        {
          iterations: 25,
          warmup: 6,
          setup: () => {
            if (dispose) dispose();
            const container = makeContainer();
            const [val, setVal] = createSignal('init');
            dispose = render(() => <FanOut n={n} val={val} />, container);
            return { setVal, counter: createMutationCounter(container) };
          },
        },
      );
      if (dispose) dispose();
      fan['subscribers=' + n] = {
        subscribers: n,
        ...timing,
        domMutations: mutations,
        note: 'one write updates exactly `subscribers` text nodes; no wasted computation',
      };
    }
    benchmarks.D_fanOut = fan;
  }

  // E — Deep reactive state: update ONE nested branch via createStore path.
  {
    let mutations = 0;
    let n = 0;
    let dispose = null;
    const timing = await measure(
      (s) => {
        s.counter.start();
        n = (n + 1) % 1000;
        s.setUser('activity', { lastSeen: n, streak: n });
        mutations = s.counter.stop().total;
      },
      {
        iterations: 40,
        warmup: 8,
        setup: () => {
          if (dispose) dispose();
          const container = makeContainer();
          const [user, setUser] = createStore(freshUser());
          dispose = render(() => <DeepState user={user} />, container);
          return { setUser, counter: createMutationCounter(container) };
        },
      },
    );
    if (dispose) dispose();
    benchmarks.E_deepState = {
      leaves: 4,
      ...timing,
      nodesUpdated: mutations,
      note: 'update one deep branch; nodesUpdated MUST be 1 of 4 leaves (fine-grained store)',
    };
  }

  // G — Hydration: adopt server markup for the 10k tree. Solid client builds
  // cannot server-render, so the orchestrator injects the SSR output.
  {
    const html = globalThis.__SOLID_SSR_HTML__;
    if (typeof html === 'string') {
      let created = 0;
      let dispose = null;
      const timing = await measure(
        (s) => {
          s.counter.start();
          s.dispose = hydrate(() => <FlatList n={N_BIG} />, s.container);
          created = s.counter.stop().added;
        },
        {
          iterations: 15,
          warmup: 4,
          setup: () => {
            if (dispose) dispose();
            const container = makeContainer();
            container.innerHTML = html;
            const s = { container, counter: createMutationCounter(container) };
            Promise.resolve().then(() => (dispose = s.dispose));
            return s;
          },
        },
      );
      if (dispose) dispose();
      benchmarks.G_hydration = {
        nodes: N_BIG,
        ...timing,
        domNodesCreatedDuringHydration: created,
        environment: 'chromium (Playwright)',
        note: 'adopts server DOM; domNodesCreatedDuringHydration should be ~0 for a matching tree',
      };
    } else {
      benchmarks.G_hydration = {
        nodes: N_BIG,
        status: 'SKIPPED',
        note: 'Solid client build cannot server-render; run via benchmarks/run-competitors.mjs which injects __SOLID_SSR_HTML__ from the SSR build. No numbers fabricated.',
      };
    }
  }

  return benchmarks;
}
