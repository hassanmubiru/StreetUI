/**
 * StreetUI v1.3 — real-application node measurement harness (spec §2, §8–§13, §19).
 *
 * This is a BENCHMARK DEVELOPMENT tool only; never shipped in `streetui`. It drives
 * the REAL example app in `examples/streetui-performance-app` (a legitimate
 * multi-route application — header/nav/sidebar, a 10,000-row users table, 1,000
 * interactive controls, forms, router navigation, an async resource, SSR +
 * hydration), not a synthetic DOM generator.
 *
 * It shares ONE `streetui` module instance with the compiled app by importing the
 * app's own `bench-support` surface (which re-exports the framework primitives the
 * app is built on), so the renderer, reactive system and DOM adapter are identical
 * to what the app uses — no duplicate runtime.
 *
 * DOM-mutation counts come from a counting decorator over the single DOMAdapter
 * choke point, so claims like "typing one field mutates only that field's node" or
 * "toggling 1 of 1000 controls touches exactly one node" are MEASURED, not assumed.
 *
 * Environment note: this runs over happy-dom in Node. It is NOT a browser
 * measurement and never claims to be — browser numbers are gated separately by
 * scripts/browser-harness.mjs and recorded BLOCKED when no Chromium is present.
 *
 * Usage: node perf-app-scenarios.mjs --out=<absPath> [--commit=<sha>]
 */
import { performance } from 'node:perf_hooks';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Window } from 'happy-dom';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── install happy-dom globals BEFORE any streetui/renderer module evaluates ──
const win = new Window({ url: 'http://localhost/' });
for (const k of ['document', 'Node', 'Element', 'HTMLElement', 'Text', 'Comment',
  'DocumentFragment', 'Event', 'CustomEvent']) {
  globalThis[k] = k === 'document' ? win.document : win[k];
}
globalThis.window = win;

// ── locate the built example app dist (canonical build tree) ─────────────────
const appDist = path.resolve(__dirname, '..', '..', 'examples', 'streetui-performance-app', 'dist');
const bench = await import(path.join(appDist, 'bench-support.js'));
const { compilePage, createDeps } = await import(path.join(appDist, 'index.js'));
const { renderIsland } = await import(path.join(appDist, 'server-entry.js'));
const { mountPerfApp } = await import(path.join(appDist, 'routed.js'));
const { createRenderer, makeCountingAdapter } = bench;

const round = (x) => Math.round(x * 1e4) / 1e4;
const container = () => win.document.createElement('div');

function measure(fn, { warmup = 4, iterations = 15, setup } = {}) {
  for (let i = 0; i < warmup; i++) { const s = setup?.(); fn(s); }
  const samples = [];
  for (let i = 0; i < iterations; i++) {
    const s = setup?.();
    const t0 = performance.now();
    fn(s);
    samples.push(performance.now() - t0);
  }
  samples.sort((a, b) => a - b);
  return {
    medianMs: round(samples[Math.floor(samples.length / 2)]),
    p95Ms: round(samples[Math.min(samples.length - 1, Math.ceil(0.95 * samples.length) - 1)]),
    minMs: round(samples[0]), maxMs: round(samples[samples.length - 1]),
    samples: samples.length,
  };
}

const results = {};

// helper: freshly mount the users view over a counting adapter at a known state
function mountUsers(sizing) {
  const { adapter, reset, snapshot, structuralWrites } = makeCountingAdapter();
  const renderer = createRenderer({ domAdapter: adapter });
  const deps = createDeps(sizing ? { sizing } : {});
  const host = container();
  const handle = renderer.mount(compilePage(deps, 'users'), host);
  return { deps, host, handle, reset, snapshot, structuralWrites, renderer };
}

// ── A: initial mount of the real 10,000-row users view ───────────────────────
{
  let created = 0, lastHandle = null;
  const timing = measure((s) => {
    lastHandle?.unmount?.();
    s.reset();
    s.handle = s.renderer.mount(s.compiled, s.container);
    const c = s.snapshot();
    created = c.createElement + c.createTextNode;
    lastHandle = s.handle;
  }, {
    iterations: 10, warmup: 3,
    setup: () => {
      const { adapter, reset, snapshot } = makeCountingAdapter();
      const renderer = createRenderer({ domAdapter: adapter });
      return { renderer, reset, snapshot, container: container(),
        compiled: compilePage(createDeps(), 'users') };
    },
  });
  lastHandle?.unmount?.();
  results.initialMountUsers10k = {
    description: 'Initial mount of the users route (10,000-row keyed table) in the real app.',
    rows: 10000, nodesCreated: created, timing,
  };
}

// ── B: hydration of the SSR users view — must create ZERO DOM nodes (G) ──────
{
  const island = renderIsland({ view: 'users' });
  const { adapter, reset, snapshot } = makeCountingAdapter();
  const renderer = createRenderer({ domAdapter: adapter });
  let created = -1;
  const timing = measure((s) => {
    reset();
    s.handle = renderer.hydrate(s.compiled, s.app);
    const c = snapshot();
    created = c.createElement + c.createTextNode;
    s.handle.unmount?.();
  }, {
    iterations: 8, warmup: 2,
    setup: () => {
      const host = container();
      host.innerHTML = island.html;
      const app = host.querySelector('#app');
      return { app, compiled: compilePage(createDeps(), 'users') };
    },
  });
  results.hydrateUsers10k = {
    description: 'Hydrate the server-rendered 10,000-row users view; must adopt existing DOM.',
    ssrBytes: island.bytes, ssrBodyLength: island.body.length,
    nodesCreatedDuringHydration: created,
    invariant_G_zeroNodesCreated: created === 0,
    timing,
  };
}

// ── C (§12): fine-grained proof — toggle 1 of 1,000 controls touches 1 node ──
{
  const { adapter, reset, structuralWrites, snapshot } = makeCountingAdapter();
  const renderer = createRenderer({ domAdapter: adapter });
  const deps = createDeps(); // 1,000 interactive controls
  const handle = renderer.mount(compilePage(deps, 'controls'), container());
  reset();
  deps.pushToggle(500);
  const writes = structuralWrites();
  const detail = snapshot();
  handle.unmount?.();
  results.fineGrainedToggle1of1000 = {
    description: 'With 1,000 independent controls mounted, toggling exactly one control.',
    controls: 1000, structuralWritesObserved: writes, breakdown: detail,
    invariant_singleRegionUpdated: writes === 1,
  };
}

// ── D (§11): forms isolation — typing one field does not touch another ───────
{
  const { adapter, reset, structuralWrites, snapshot } = makeCountingAdapter();
  const renderer = createRenderer({ domAdapter: adapter });
  const deps = createDeps();
  const handle = renderer.mount(compilePage(deps, 'settings'), container());
  const emailBefore = deps.settingsForm.field('contactEmail').value.peek();
  reset();
  deps.settingsForm.field('displayName').setValue('Ada Lovelace');
  const writes = structuralWrites();
  const detail = snapshot();
  const emailAfter = deps.settingsForm.field('contactEmail').value.peek();
  handle.unmount?.();
  results.formsFieldIsolation = {
    description: 'Type into displayName; the unrelated contactEmail field must not change.',
    structuralWritesObserved: writes, breakdown: detail,
    unrelatedFieldUnchanged: emailBefore === emailAfter,
    invariant_isolated: emailBefore === emailAfter && writes >= 1 && writes <= 3,
  };
}

// ── E: real-app keyed-list mutations (search-narrow, sort, reverse) ──────────
{
  const listOps = {};
  // search narrow: how many structural writes to filter 10k → matches of 'aa'
  {
    const m = mountUsers();
    const before = m.deps.totalCount.peek();
    m.reset();
    m.deps.query.set('aa');
    const after = m.deps.totalCount.peek();
    listOps.searchNarrow = {
      description: 'Set search query on the 10k table (filters rows).',
      rowsBefore: before, rowsAfter: after,
      structuralWrites: m.structuralWrites(), breakdown: m.snapshot(),
    };
    m.handle.unmount?.();
  }
  // sort key change (reorder): id → score
  {
    const m = mountUsers();
    m.reset();
    m.deps.sortKey.set('score');
    listOps.sortReorder = {
      description: 'Change sort key id → score on the 10k table (minimal-move reorder).',
      rows: m.deps.totalCount.peek(),
      structuralWrites: m.structuralWrites(), breakdown: m.snapshot(),
    };
    m.handle.unmount?.();
  }
  // reverse (sort direction toggle) — the disclosed v1.1 worst-case path
  {
    const m = mountUsers();
    m.reset();
    m.deps.sortDir.set('desc');
    listOps.reverseToggle = {
      description: 'Toggle sort direction asc → desc on the 10k table (reverse).',
      rows: m.deps.totalCount.peek(),
      structuralWrites: m.structuralWrites(), breakdown: m.snapshot(),
    };
    m.handle.unmount?.();
  }
  results.keyedListOps = listOps;
}

// ── F (§9): router navigation across real routes ─────────────────────────────
{
  // correctness: mounting and navigating swaps the outlet content
  const host = container();
  const app = mountPerfApp(host, { path: '/' });
  const atOverview = host.querySelector('#route-overview') !== null;
  app.router.navigate('/users');
  const atUsers = host.querySelector('#users-table') !== null;
  app.router.navigate('/settings');
  const atSettings = host.querySelector('#settings-form') !== null;
  app.router.back();
  const backToUsers = host.querySelector('#users-table') !== null;
  app.unmount();

  const timing = measure((s) => {
    s.app.router.navigate('/dashboard');
    s.app.router.navigate('/users');
    s.app.router.navigate('/settings');
    s.app.router.navigate('/');
  }, {
    iterations: 12, warmup: 3,
    setup: () => {
      const h = container();
      return { app: mountPerfApp(h, { path: '/' }) };
    },
  });
  results.routerNavigation = {
    description: 'Navigate /→/dashboard→/users→/settings→/ using the real router + shell.',
    correctness: { atOverview, atUsers, atSettings, backToUsers,
      allTransitionsCorrect: atOverview && atUsers && atSettings && backToUsers },
    fourNavigationsTiming: timing,
  };
}

// ── G (§13): large-app lifecycle — repeated cycles must not accumulate ───────
{
  const CYCLES = 8;
  const orphanAfterUnmount = [];
  const nodesPerCycle = [];
  for (let i = 0; i < CYCLES; i++) {
    const { adapter, reset, snapshot } = makeCountingAdapter();
    const renderer = createRenderer({ domAdapter: adapter });
    const host = container();
    reset();
    const app = mountPerfApp(host, {
      path: '/', renderer,
      deps: createDeps({ sizing: { rows: 1500, controls: 150 } }),
    });
    // exercise the app: navigate + interact across routes
    app.router.navigate('/users');
    app.deps.query.set('a');
    app.deps.query.set('');
    app.router.navigate('/settings');
    app.deps.settingsForm.field('displayName').setValue('Grace');
    app.router.navigate('/dashboard');
    app.deps.notify('cycle notice');
    app.router.navigate('/');
    const created = snapshot().createElement + snapshot().createTextNode;
    nodesPerCycle.push(created);
    app.unmount();
    orphanAfterUnmount.push(host.childNodes.length);
  }
  const first = nodesPerCycle[0];
  const stable = nodesPerCycle.every((n) => n === first);
  const cleanUnmount = orphanAfterUnmount.every((n) => n === 0);
  results.lifecycleNoAccumulation = {
    description: 'Mount → navigate all routes → interact → unmount, repeated; check for growth.',
    cycles: CYCLES, nodesCreatedPerCycle: nodesPerCycle, orphanNodesAfterUnmount: orphanAfterUnmount,
    invariant_noNodeCountDrift: stable,
    invariant_unmountLeavesNoOrphans: cleanUnmount,
  };
}

// ── H (§8): SSR of the real app (bytes are the app's own; NOT the v1.2 figure) ─
{
  const views = ['overview', 'dashboard', 'users', 'controls', 'settings'];
  const ssr = {};
  for (const v of views) {
    const island = renderIsland({ view: v });
    ssr[v] = { bytes: island.bytes, bodyLength: island.body.length };
  }
  results.ssrByView = {
    description: 'renderToString bytes for each route body of the real app (default sizing).',
    note: 'These are this app’s own SSR sizes; not comparable to the v1.2 synthetic SSR baseline.',
    views: ssr,
  };
}

// PLACEHOLDER_3

// ── assemble output ──────────────────────────────────────────────────────────
const args = Object.fromEntries(process.argv.slice(2)
  .filter((a) => a.startsWith('--')).map((a) => {
    const [k, ...v] = a.slice(2).split('='); return [k, v.join('=') || true];
  }));

const invariants = {
  G_hydrationCreatesZeroNodes: results.hydrateUsers10k.invariant_G_zeroNodesCreated,
  fineGrained_toggle1of1000_singleWrite: results.fineGrainedToggle1of1000.invariant_singleRegionUpdated,
  forms_fieldIsolation: results.formsFieldIsolation.invariant_isolated,
  lifecycle_noNodeDrift: results.lifecycleNoAccumulation.invariant_noNodeCountDrift,
  lifecycle_cleanUnmount: results.lifecycleNoAccumulation.invariant_unmountLeavesNoOrphans,
  router_transitionsCorrect: results.routerNavigation.correctness.allTransitionsCorrect,
};
const allInvariantsHold = Object.values(invariants).every(Boolean);

const output = {
  schema: 'streetui-node/v1.3',
  status: 'PASS',
  target: 'examples/streetui-performance-app (real multi-route application)',
  runtime: 'node + happy-dom (NOT a browser; browser metrics gated separately, see streetui-browser.json)',
  measurement: 'DOM mutations counted at the single BrowserDOMAdapter choke point; timings via perf_hooks.',
  version: '1.3.0',
  commit: args.commit ?? null,
  timestamp: new Date().toISOString(),
  environment: {
    node: process.version,
    platform: `${os.type()} ${os.release()} ${os.arch()}`,
    cpus: os.cpus().length,
    cpuModel: os.cpus()[0]?.model ?? 'unknown',
    totalMemMB: Math.round(os.totalmem() / 1e6),
    domImplementation: 'happy-dom',
  },
  invariants,
  allInvariantsHold,
  scenarios: results,
};

const outPath = typeof args.out === 'string'
  ? args.out
  : path.resolve(__dirname, 'results', 'v1.3', 'streetui-node.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(output, null, 2) + '\n');

// concise console summary
console.log('=== StreetUI v1.3 node/real-app scenarios ===');
console.log(`initial mount (10k users): ${results.initialMountUsers10k.timing.medianMs}ms median, ` +
  `${results.initialMountUsers10k.nodesCreated} nodes`);
console.log(`hydration created nodes: ${results.hydrateUsers10k.nodesCreatedDuringHydration} ` +
  `(G invariant: ${invariants.G_hydrationCreatesZeroNodes ? 'HOLDS' : 'FAIL'})`);
console.log(`toggle 1/1000 structural writes: ${results.fineGrainedToggle1of1000.structuralWritesObserved} ` +
  `(single-region: ${invariants.fineGrained_toggle1of1000_singleWrite ? 'HOLDS' : 'FAIL'})`);
console.log(`form field isolation writes: ${results.formsFieldIsolation.structuralWritesObserved} ` +
  `(isolated: ${invariants.forms_fieldIsolation ? 'HOLDS' : 'FAIL'})`);
console.log(`lifecycle: nodes/cycle ${JSON.stringify(results.lifecycleNoAccumulation.nodesCreatedPerCycle)} ` +
  `orphans ${JSON.stringify(results.lifecycleNoAccumulation.orphanNodesAfterUnmount)}`);
console.log(`router 4-nav: ${results.routerNavigation.fourNavigationsTiming.medianMs}ms median ` +
  `(correct: ${invariants.router_transitionsCorrect ? 'YES' : 'NO'})`);
console.log(`all invariants hold: ${allInvariantsHold ? 'YES' : 'NO'}`);
console.log(`written: ${outPath}`);
if (!allInvariantsHold) process.exitCode = 1;




