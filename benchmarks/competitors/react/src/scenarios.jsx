// DEV-ONLY benchmark artifact — React 19 in-browser scenario runner. NOT part of the `streetui` runtime.
/**
 * React 19 browser scenarios A, B, C, D, E, G. Designed to run inside Chromium
 * (driven by Playwright via the Vite preview server). Returns result objects in
 * the exact shape of `benchmarks/results/baseline.json`.
 *
 * Fairness notes:
 *   - Updates are wrapped in `flushSync` so the DOM is committed synchronously
 *     before we stop the clock — the same "measure to committed DOM" contract
 *     the StreetUI harness gets for free from its synchronous scheduler.
 *   - DOM mutations are counted with a MutationObserver drained via
 *     `takeRecords()` (see shared/measure.mjs), the browser analogue of
 *     StreetUI's counting DOMAdapter.
 */

import { createRoot, hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { flushSync } from 'react-dom';
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

const mountSync = (root, el) => flushSync(() => root.render(el));

export async function runBrowserScenarios() {
  const benchmarks = {};

  // A — Initial render of 10,000 rows: DOM-creation time + nodes created.
  {
    let created = 0;
    const timing = await measure(
      (s) => {
        mountSync(s.root, <FlatList n={N_BIG} />);
        created = countDomNodes(s.container);
      },
      {
        iterations: 15,
        warmup: 4,
        setup: () => {
          const container = makeContainer();
          return { container, root: createRoot(container) };
        },
      },
    );
    benchmarks.A_initialRender = {
      nodes: N_BIG,
      ...timing,
      domNodesCreated: created,
      note: 'time to create DOM; synchronous flushSync render == interactive',
    };
  }

  // B — One reactive update inside a 10,000-node tree: only relevant DOM touched.
  {
    let mutations = 0;
    let toggle = false;
    const timing = await measure(
      (s) => {
        s.counter.start();
        toggle = !toggle;
        flushSync(() => s.bridge.setLive(toggle ? 'A' : 'B'));
        mutations = s.counter.stop().total;
      },
      {
        iterations: 40,
        warmup: 8,
        setup: () => {
          const container = makeContainer();
          const bridge = {};
          mountSync(createRoot(container), <OneBound n={N_BIG} bridge={bridge} />);
          return { bridge, counter: createMutationCounter(container) };
        },
      },
    );
    benchmarks.B_singleUpdate = {
      nodes: N_BIG,
      ...timing,
      domMutations: mutations,
      note: 'one setState in a 10k tree; domMutations MUST be 1 (targeted, no subtree re-render)',
    };
  }

  // C — Large keyed list (10,000 items): per-operation cost + node churn.
  {
    const list = {};
    for (const op of LIST_OPS) {
      const transform = LIST_TRANSFORMS[op];
      let created = 0;
      let removed = 0;
      const timing = await measure(
        (s) => {
          s.counter.start();
          flushSync(() => s.bridge.setItems(s.target));
          const c = s.counter.stop();
          created = c.added;
          removed = c.removed;
        },
        {
          iterations: 12,
          warmup: 3,
          setup: () => {
            const container = makeContainer();
            const bridge = {};
            const base = makeItems(N_BIG);
            mountSync(createRoot(container), <KeyedList initial={base} bridge={bridge} />);
            return { bridge, counter: createMutationCounter(container), target: transform(base, N_BIG) };
          },
        },
      );
      list[op] = { items: N_BIG, ...timing, domNodesCreated: created, domNodesRemoved: removed };
    }
    benchmarks.C_largeList = list;
  }

  // D — Reactive fan-out (1 setState → 1,000 / 10,000 bound cells).
  {
    const fan = {};
    for (const n of FANOUT_SIZES) {
      let mutations = 0;
      let toggle = false;
      const timing = await measure(
        (s) => {
          s.counter.start();
          toggle = !toggle;
          flushSync(() => s.bridge.setVal(toggle ? 'x' : 'y'));
          mutations = s.counter.stop().total;
        },
        {
          iterations: 25,
          warmup: 6,
          setup: () => {
            const container = makeContainer();
            const bridge = {};
            mountSync(createRoot(container), <FanOut n={n} bridge={bridge} />);
            return { bridge, counter: createMutationCounter(container) };
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

  // E — Deep reactive state: update ONE nested branch, measure nodes updated.
  {
    let mutations = 0;
    let n = 0;
    const timing = await measure(
      (s) => {
        s.counter.start();
        n = (n + 1) % 1000;
        flushSync(() =>
          s.bridge.setUser((u) => ({ ...u, activity: { lastSeen: n, streak: n } })),
        );
        mutations = s.counter.stop().total;
      },
      {
        iterations: 40,
        warmup: 8,
        setup: () => {
          const container = makeContainer();
          const bridge = {};
          mountSync(createRoot(container), <DeepState bridge={bridge} />);
          return { bridge, counter: createMutationCounter(container) };
        },
      },
    );
    benchmarks.E_deepState = {
      leaves: 4,
      ...timing,
      nodesUpdated: mutations,
      note: 'update one deep branch; nodesUpdated MUST be 1 of 4 leaves (React diffs to the one text node)',
    };
  }

  // G — Hydration: adopt server markup for the 10k tree, measure adoption cost.
  {
    const html = renderToString(<FlatList n={N_BIG} />);
    let created = 0;
    const timing = await measure(
      (s) => {
        s.counter.start();
        flushSync(() => {
          hydrateRoot(s.container, <FlatList n={N_BIG} />);
        });
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
