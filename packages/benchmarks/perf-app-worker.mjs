/**
 * StreetUI v1.3 — real-app node measurement WORKER (spec §2, §8–§13).
 *
 * Runs exactly ONE scenario against the real example app, then prints a single
 * `__RESULT__<json>` line to stdout. It is spawned once per scenario by
 * perf-app-scenarios.mjs so that each scale-sensitive scenario (the 10,000-row
 * table needs ~0.8 GB of happy-dom nodes) gets a fresh process and cannot
 * accumulate memory across scenarios. This is a benchmark-development tool only;
 * never shipped in `streetui`.
 *
 * happy-dom is installed as the global DOM before any renderer module evaluates.
 * All framework primitives come from the app's own `bench-support` surface, so
 * the renderer/reactive-system/DOM-adapter instance is identical to the app's.
 *
 * Usage: node --expose-gc perf-app-worker.mjs <scenarioName>
 */
import { performance } from 'node:perf_hooks';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Window } from 'happy-dom';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const win = new Window({ url: 'http://localhost/' });
for (const k of ['document', 'Node', 'Element', 'HTMLElement', 'Text', 'Comment',
  'DocumentFragment', 'Event', 'CustomEvent']) {
  globalThis[k] = k === 'document' ? win.document : win[k];
}
globalThis.window = win;

const appDist = path.resolve(__dirname, '..', '..', 'examples', 'streetui-performance-app', 'dist');
const bench = await import(path.join(appDist, 'bench-support.js'));
const { compilePage, createDeps } = await import(path.join(appDist, 'index.js'));
const { renderIsland } = await import(path.join(appDist, 'server-entry.js'));
const { mountPerfApp } = await import(path.join(appDist, 'routed.js'));
const { createRenderer, makeCountingAdapter } = bench;

const gc = () => { try { globalThis.gc?.(); } catch { /* no --expose-gc */ } };
const round = (x) => Math.round(x * 1e4) / 1e4;
const container = () => win.document.createElement('div');

function measure(fn, { warmup = 2, iterations = 5, setup, afterEach } = {}) {
  for (let i = 0; i < warmup; i++) { const s = setup?.(); fn(s); afterEach?.(s); gc(); }
  const samples = [];
  for (let i = 0; i < iterations; i++) {
    const s = setup?.();
    const t0 = performance.now();
    fn(s);
    samples.push(performance.now() - t0);
    afterEach?.(s);
    gc();
  }
  samples.sort((a, b) => a - b);
  return {
    medianMs: round(samples[Math.floor(samples.length / 2)]),
    p95Ms: round(samples[Math.min(samples.length - 1, Math.ceil(0.95 * samples.length) - 1)]),
    minMs: round(samples[0]), maxMs: round(samples[samples.length - 1]), samples: samples.length,
  };
}

const mountUsers = () => {
  const { adapter, reset, snapshot, structuralWrites } = makeCountingAdapter();
  const renderer = createRenderer({ domAdapter: adapter });
  const deps = createDeps();
  const host = container();
  const handle = renderer.mount(compilePage(deps, 'users'), host);
  return { deps, host, handle, reset, snapshot, structuralWrites };
};

// PLACEHOLDER_SCENARIOS

const scenarios = {
  initialMountUsers10k() {
    let created = 0, last = null;
    const timing = measure((s) => {
      s.handle = s.renderer.mount(s.compiled, s.container);
      const c = s.snapshot();
      created = c.createElement + c.createTextNode;
      last = s.handle;
    }, {
      iterations: 5, warmup: 2,
      setup: () => {
        const { adapter, reset, snapshot } = makeCountingAdapter();
        const renderer = createRenderer({ domAdapter: adapter });
        reset();
        return { renderer, snapshot, container: container(), compiled: compilePage(createDeps(), 'users') };
      },
      afterEach: (s) => { s.handle?.unmount?.(); },
    });
    void last;
    return {
      description: 'Initial mount of the users route (10,000-row keyed table) in the real app.',
      rows: 10000, nodesCreated: created, timing,
    };
  },

  hydrateUsers10k() {
    const island = renderIsland({ view: 'users' });
    let created = -1;
    const timing = measure((s) => {
      s.reset();
      s.handle = s.renderer.hydrate(s.compiled, s.app);
      const c = s.snapshot();
      created = c.createElement + c.createTextNode;
    }, {
      iterations: 3, warmup: 1,
      setup: () => {
        const { adapter, reset, snapshot } = makeCountingAdapter();
        const renderer = createRenderer({ domAdapter: adapter });
        const host = container();
        host.innerHTML = island.html;
        const app = host.querySelector('#app');
        return { renderer, reset, snapshot, app, compiled: compilePage(createDeps(), 'users') };
      },
      afterEach: (s) => { s.handle?.unmount?.(); },
    });
    return {
      description: 'Hydrate the server-rendered 10,000-row users view; must adopt existing DOM.',
      ssrBytes: island.bytes, ssrBodyLength: island.body.length,
      nodesCreatedDuringHydration: created,
      invariant_G_zeroNodesCreated: created === 0, timing,
    };
  },

  fineGrainedToggle1of1000() {
    // Toggle exactly one control at two different control counts. The number of
    // structural writes must be IDENTICAL regardless of how many controls exist —
    // that is the fine-grained property (§12): an update is O(affected regions),
    // never O(total regions). Here each toggle touches exactly two text nodes: the
    // control's own on/off label AND the intentional live `toggled:N` summary.
    const run = (count) => {
      const { adapter, reset, structuralWrites, snapshot } = makeCountingAdapter();
      const renderer = createRenderer({ domAdapter: adapter });
      const deps = createDeps({ sizing: { rows: 10, controls: count } });
      const handle = renderer.mount(compilePage(deps, 'controls'), container());
      reset();
      deps.pushToggle(Math.floor(count / 2));
      const writes = structuralWrites();
      const detail = snapshot();
      handle.unmount?.(); gc();
      return { writes, detail };
    };
    const at1000 = run(1000);
    const at100 = run(100);
    return {
      description: 'Toggle one of N controls; structural writes must not scale with N (§12).',
      writesAt1000Controls: at1000.writes, breakdownAt1000: at1000.detail,
      writesAt100Controls: at100.writes,
      explanation: 'Each toggle updates two text nodes: the toggled control label + the live `toggled:N` counter.',
      invariant_singleRegionUpdated: at1000.writes === at100.writes && at1000.writes <= 2,
    };
  },

  formsFieldIsolation() {
    // Direct DOM-level proof (§11): typing into displayName must not mutate the
    // contactEmail input node. We read the real DOM `value` of the unrelated input
    // before and after, at the single adapter choke point.
    const { adapter, reset, structuralWrites, snapshot } = makeCountingAdapter();
    const renderer = createRenderer({ domAdapter: adapter });
    const deps = createDeps();
    const host = container();
    const handle = renderer.mount(compilePage(deps, 'settings'), host);
    const emailInput = host.querySelector('#contactEmail');
    const nameInput = host.querySelector('#displayName');
    const emailDomBefore = emailInput ? emailInput.value : null;
    const emailSigBefore = deps.settingsForm.field('contactEmail').value.peek();
    reset();
    deps.settingsForm.field('displayName').setValue('Ada Lovelace');
    const writes = structuralWrites();
    const detail = snapshot();
    const emailDomAfter = emailInput ? emailInput.value : null;
    const emailSigAfter = deps.settingsForm.field('contactEmail').value.peek();
    const nameDomAfter = nameInput ? nameInput.value : null;
    handle.unmount?.();
    return {
      description: 'Type into displayName; the unrelated contactEmail input must not change (§11).',
      structuralWritesObserved: writes, breakdown: detail,
      unrelatedInputDomUnchanged: emailDomBefore === emailDomAfter,
      unrelatedSignalUnchanged: emailSigBefore === emailSigAfter,
      typedFieldReflectsInput: nameDomAfter === 'Ada Lovelace',
      invariant_isolated:
        emailDomBefore === emailDomAfter &&
        emailSigBefore === emailSigAfter &&
        nameDomAfter === 'Ada Lovelace',
    };
  },

  keyedListOps() {
    const listOps = {};
    { const m = mountUsers(); const before = m.deps.totalCount.peek(); m.reset();
      m.deps.query.set('aa'); const after = m.deps.totalCount.peek();
      listOps.searchNarrow = { description: 'Set search query on the 10k table (filters rows).',
        rowsBefore: before, rowsAfter: after, structuralWrites: m.structuralWrites(), breakdown: m.snapshot() };
      m.handle.unmount?.(); gc(); }
    { const m = mountUsers(); m.reset(); m.deps.sortKey.set('score');
      listOps.sortReorder = { description: 'Change sort key id → score (minimal-move reorder).',
        rows: m.deps.totalCount.peek(), structuralWrites: m.structuralWrites(), breakdown: m.snapshot() };
      m.handle.unmount?.(); gc(); }
    { const m = mountUsers(); m.reset(); m.deps.sortDir.set('desc');
      listOps.reverseToggle = { description: 'Toggle sort direction asc → desc (reverse).',
        rows: m.deps.totalCount.peek(), structuralWrites: m.structuralWrites(), breakdown: m.snapshot() };
      m.handle.unmount?.(); gc(); }
    return listOps;
  },

  routerNavigation() {
    const host = container();
    const app = mountPerfApp(host, { path: '/' });
    const atOverview = host.querySelector('#route-overview') !== null;
    app.router.navigate('/users');
    const atUsers = host.querySelector('#users-table') !== null;
    app.router.navigate('/settings');
    const atSettings = host.querySelector('#settings-form') !== null;
    app.router.back();
    const backToUsers = host.querySelector('#users-table') !== null;
    app.unmount(); gc();
    const timing = measure((s) => {
      s.app.router.navigate('/dashboard');
      s.app.router.navigate('/users');
      s.app.router.navigate('/settings');
      s.app.router.navigate('/');
    }, {
      iterations: 10, warmup: 2,
      setup: () => ({ app: mountPerfApp(container(), { path: '/',
        deps: createDeps({ sizing: { rows: 2000, controls: 200 } }) }) }),
      afterEach: (s) => { s.app.unmount(); },
    });
    return {
      description: 'Navigate /→/dashboard→/users→/settings→/ using the real router + shell.',
      correctness: { atOverview, atUsers, atSettings, backToUsers,
        allTransitionsCorrect: atOverview && atUsers && atSettings && backToUsers },
      fourNavigationsTiming: timing,
    };
  },

  lifecycleNoAccumulation() {
    const CYCLES = 8;
    const orphanAfterUnmount = [];
    const nodesPerCycle = [];
    for (let i = 0; i < CYCLES; i++) {
      const { adapter, reset, snapshot } = makeCountingAdapter();
      const renderer = createRenderer({ domAdapter: adapter });
      const host = container();
      reset();
      const app = mountPerfApp(host, { path: '/', renderer,
        deps: createDeps({ sizing: { rows: 1500, controls: 150 } }) });
      app.router.navigate('/users');
      app.deps.query.set('a'); app.deps.query.set('');
      app.router.navigate('/settings');
      app.deps.settingsForm.field('displayName').setValue('Grace');
      app.router.navigate('/dashboard');
      app.deps.notify('cycle notice');
      app.router.navigate('/');
      nodesPerCycle.push(snapshot().createElement + snapshot().createTextNode);
      app.unmount();
      orphanAfterUnmount.push(host.childNodes.length);
      gc();
    }
    const first = nodesPerCycle[0];
    return {
      description: 'Mount → navigate all routes → interact → unmount, repeated; check for growth.',
      cycles: CYCLES, nodesCreatedPerCycle: nodesPerCycle, orphanNodesAfterUnmount: orphanAfterUnmount,
      invariant_noNodeCountDrift: nodesPerCycle.every((n) => n === first),
      invariant_unmountLeavesNoOrphans: orphanAfterUnmount.every((n) => n === 0),
    };
  },

  ssrByView() {
    const views = ['overview', 'dashboard', 'users', 'controls', 'settings'];
    const ssr = {};
    for (const v of views) { const island = renderIsland({ view: v });
      ssr[v] = { bytes: island.bytes, bodyLength: island.body.length }; gc(); }
    return {
      description: 'renderToString bytes for each route body of the real app (default sizing).',
      note: 'These are this app’s own SSR sizes; not comparable to the v1.2 synthetic SSR baseline.',
      views: ssr,
    };
  },
};

const name = process.argv[2];
if (!name || !(name in scenarios)) {
  console.error(`unknown scenario: ${name}; known: ${Object.keys(scenarios).join(', ')}`);
  process.exit(2);
}
const result = await scenarios[name]();
process.stdout.write('__RESULT__' + JSON.stringify(result) + '\n');

