/**
 * StreetUI v1.1 scenario benchmark runner (spec §2–§9).
 *
 * This is a BENCHMARK DEVELOPMENT tool only — it is never part of the shipped
 * `streetui` runtime. It exercises the real public pipeline
 * (`streetui.app` → `compile` → `createRenderer().mount/hydrate` / `renderToString`)
 * through the real BrowserDOMAdapter over happy-dom, and emits the spec-shaped
 * scenario JSON (scenarios A–H) to `benchmarks/results/<label>.json`.
 *
 * DOM-mutation counts are obtained by wrapping the DOMAdapter (the single choke
 * point every renderer write flows through) with a counting decorator, so
 * "did a single signal write touch only the relevant node?" is measured, not
 * assumed.
 *
 * Usage:
 *   node v11-scenarios.mjs --out=<absPath> --label=streetui [--commit=<sha>]
 *
 * happy-dom is installed as the global DOM before any renderer import runs.
 */

import { performance } from 'node:perf_hooks';
import os from 'node:os';
import fs from 'node:fs';
import { Window } from 'happy-dom';

// ── install happy-dom globals (before renderer touches `document`) ───────────
const win = new Window({ url: 'http://localhost/' });
for (const k of ['document', 'Node', 'Element', 'HTMLElement', 'Text', 'Comment',
  'DocumentFragment', 'Event', 'CustomEvent']) {
  globalThis[k] = k === 'document' ? win.document : win[k];
}
globalThis.window = win;

const { streetui } = await import('@streetui/dsl');
const { compile } = await import('@streetui/compiler');
const { signal, derived } = await import('@streetui/state');
const { createRenderer, renderToString } = await import('@streetui/renderer');
const { BrowserDOMAdapter } = await import('@streetui/dom');

// ── DOM-mutation counting adapter ────────────────────────────────────────────
function makeCountingAdapter() {
  const base = new BrowserDOMAdapter();
  const c = { createElement: 0, createTextNode: 0, setAttribute: 0, removeAttribute: 0,
    setProperty: 0, setTextContent: 0, appendChild: 0, insertBefore: 0, removeChild: 0 };
  const wrap = {
    reset() { for (const k of Object.keys(c)) c[k] = 0; },
    snapshot() { return { ...c }; },
    total() { return Object.values(c).reduce((a, b) => a + b, 0); },
    structuralWrites() { return c.setAttribute + c.removeAttribute + c.setProperty +
      c.setTextContent + c.appendChild + c.insertBefore + c.removeChild; },
  };
  const adapter = {
    createElement(t) { c.createElement++; return base.createElement(t); },
    createTextNode(d) { c.createTextNode++; return base.createTextNode(d); },
    createComment(d) { return base.createComment(d); },
    appendChild(p, ch) { c.appendChild++; return base.appendChild(p, ch); },
    insertBefore(p, ch, r) { c.insertBefore++; return base.insertBefore(p, ch, r); },
    removeChild(p, ch) { c.removeChild++; return base.removeChild(p, ch); },
    setAttribute(e, n, v) { c.setAttribute++; return base.setAttribute(e, n, v); },
    removeAttribute(e, n) { c.removeAttribute++; return base.removeAttribute(e, n); },
    setProperty(e, n, v) { c.setProperty++; return base.setProperty(e, n, v); },
    setTextContent(n, t) { c.setTextContent++; return base.setTextContent(n, t); },
  };
  // pass through any other adapter methods
  for (const k of Object.getOwnPropertyNames(Object.getPrototypeOf(base))) {
    if (k !== 'constructor' && typeof base[k] === 'function' && !(k in adapter)) {
      adapter[k] = (...a) => base[k](...a);
    }
  }
  return { adapter, counters: wrap };
}

// ── timing helper (median/p95 over samples, warmup discarded) ────────────────
function measure(fn, { warmup = 5, iterations = 25, setup } = {}) {
  for (let i = 0; i < warmup; i++) { const s = setup?.(); fn(s); }
  const samples = [];
  for (let i = 0; i < iterations; i++) {
    const s = setup?.();
    const t0 = performance.now();
    fn(s);
    samples.push(performance.now() - t0);
  }
  samples.sort((a, b) => a - b);
  const med = samples[Math.floor(samples.length / 2)];
  const p95 = samples[Math.min(samples.length - 1, Math.ceil(0.95 * samples.length) - 1)];
  return { medianMs: round(med), p95Ms: round(p95), minMs: round(samples[0]),
    maxMs: round(samples[samples.length - 1]), samples: samples.length };
}
const round = (x) => Math.round(x * 1e4) / 1e4;

// ── app builders (real public DSL) ───────────────────────────────────────────
function flatApp(n) {
  const app = streetui.app({ name: 'flat', version: '1.1.0' });
  app.page('home', (p) => p.section('main', (s) => {
    for (let i = 0; i < n; i++) s.text(`node ${i}`, { class: 'row' });
  }));
  return app;
}
// n static nodes + ONE signal-bound text (scenario B: single targeted update).
function oneBoundInManyApp(n, sig) {
  const app = streetui.app({ name: 'oneBound', version: '1.1.0' });
  app.page('home', (p) => p.section('main', (s) => {
    for (let i = 0; i < n; i++) s.text(`static ${i}`, { class: 'row' });
    s.text(sig, { class: 'live', id: 'live' });
  }));
  return app;
}
// 1 signal → n bound subscribers (scenario D: fan-out).
function fanoutApp(n, sig) {
  const app = streetui.app({ name: 'fanout', version: '1.1.0' });
  app.page('home', (p) => p.section('main', (s) => {
    for (let i = 0; i < n; i++) s.text(sig, { class: 'sub' });
  }));
  return app;
}
function listApp(items) {
  const app = streetui.app({ name: 'list', version: '1.1.0' });
  app.page('home', (p) => p.section('main', (s) => {
    s.listOf('rows', items, (item, _i, content) => content.text(item.label, { class: 'cell' }));
  }));
  return app;
}
const makeItems = (n, off = 0) => Array.from({ length: n }, (_, i) => ({ id: i + off, label: `item-${i + off}` }));
const container = () => win.document.createElement('div');

// ── scenarios ────────────────────────────────────────────────────────────────
const N_BIG = 10000;
const benchmarks = {};

// A — Initial render (10,000 nodes): DOM-creation time + nodes created.
{
  const { adapter, counters } = makeCountingAdapter();
  const renderer = createRenderer({ domAdapter: adapter });
  let created = 0;
  const timing = measure((s) => {
    counters.reset();
    s.handle = renderer.mount(s.compiled, s.container);
    created = counters.snapshot().createElement + counters.snapshot().createTextNode;
  }, { iterations: 15, warmup: 4,
    setup: () => ({ compiled: compile(flatApp(N_BIG)), container: container() }) });
  benchmarks.A_initialRender = { nodes: N_BIG, ...timing, domNodesCreated: created,
    note: 'time to create DOM; synchronous mount == interactive' };
}

// B — Single reactive update in a 10,000-node tree: only relevant DOM touched.
{
  const { adapter, counters } = makeCountingAdapter();
  const renderer = createRenderer({ domAdapter: adapter });
  let writes = 0, toggle = false;
  const timing = measure((s) => {
    counters.reset();
    toggle = !toggle;
    s.sig.set(toggle ? 'A' : 'B');
    writes = counters.structuralWrites();
  }, { iterations: 40, warmup: 8,
    setup: () => {
      const sig = signal('init');
      const handle = renderer.mount(compile(oneBoundInManyApp(N_BIG, sig)), container());
      return { sig, handle };
    } });
  benchmarks.B_singleUpdate = { nodes: N_BIG, ...timing, domMutations: writes,
    note: 'one signal write in a 10k tree; domMutations MUST be 1 (targeted, no subtree re-render)' };
}

// C — Large keyed list (10,000 items): per-operation cost + node churn.
{
  const ops = {
    append: (b, n) => [...b, ...makeItems(1, n)],
    prepend: (b, n) => [...makeItems(1, n), ...b],
    'remove-first': (b) => b.slice(1),
    'remove-middle': (b) => { const m = b.length >> 1; return [...b.slice(0, m), ...b.slice(m + 1)]; },
    'remove-last': (b) => b.slice(0, -1),
    reorder: (b) => { const c = [...b]; const f = c[0]; c[0] = c[c.length - 1]; c[c.length - 1] = f; return c; },
    reverse: (b) => [...b].reverse(),
    'update-item': (b) => b.map((it, i) => i === (b.length >> 1) ? { ...it, label: it.label + '*' } : it),
  };
  const list = {};
  for (const [op, fn] of Object.entries(ops)) {
    const { adapter, counters } = makeCountingAdapter();
    const renderer = createRenderer({ domAdapter: adapter });
    let created = 0, removed = 0;
    const timing = measure((s) => {
      counters.reset();
      s.items.set(s.target);
      const snap = counters.snapshot();
      created = snap.createElement + snap.createTextNode; removed = snap.removeChild;
    }, { iterations: 12, warmup: 3,
      setup: () => {
        const base = makeItems(N_BIG);
        const items = signal(base);
        const handle = renderer.mount(compile(listApp(items)), container());
        return { items, handle, target: fn(base, N_BIG) };
      } });
    list[op] = { items: N_BIG, ...timing, domNodesCreated: created, domNodesRemoved: removed };
  }
  benchmarks.C_largeList = list;
}

// D — Reactive fan-out (1 signal → 1,000 / 10,000 subscribers).
{
  const fan = {};
  for (const n of [1000, 10000]) {
    const { adapter, counters } = makeCountingAdapter();
    const renderer = createRenderer({ domAdapter: adapter });
    let writes = 0, toggle = false;
    const timing = measure((s) => {
      counters.reset();
      toggle = !toggle;
      s.sig.set(toggle ? 'x' : 'y');
      writes = counters.structuralWrites();
    }, { iterations: 25, warmup: 6,
      setup: () => {
        const sig = signal('init');
        const handle = renderer.mount(compile(fanoutApp(n, sig)), container());
        return { sig, handle };
      } });
    fan['subscribers=' + n] = { subscribers: n, ...timing, domMutations: writes,
      note: 'one write updates exactly `subscribers` text nodes; no wasted computation' };
  }
  benchmarks.D_fanOut = fan;
}

// E — Deep reactive state: update ONE deeply-nested value, measure nodes updated.
{
  const { adapter, counters } = makeCountingAdapter();
  const renderer = createRenderer({ domAdapter: adapter });
  // Nested app state modelled with StreetUI's existing signals (NO Proxy):
  // user.{profile,preferences,permissions,activity}. Each leaf drives one text.
  let writes = 0, n = 0;
  const timing = measure((s) => {
    counters.reset();
    n = (n + 1) % 1000;
    s.activity.set({ lastSeen: n, streak: n });     // update ONE deep branch only
    writes = counters.structuralWrites();
  }, { iterations: 40, warmup: 8,
    setup: () => {
      const profile = signal({ name: 'Ada' });
      const preferences = signal({ theme: 'dark' });
      const permissions = signal({ admin: false });
      const activity = signal({ lastSeen: 0, streak: 0 });
      const app = streetui.app({ name: 'deep', version: '1.1.0' });
      app.page('home', (p) => p.section('main', (s) => {
        // 4 leaves via derived (reactive); only the activity leaf recomputes on activity.set().
        s.text(derived(() => profile.get().name), { class: 'leaf' });
        s.text(derived(() => preferences.get().theme), { class: 'leaf' });
        s.text(derived(() => String(permissions.get().admin)), { class: 'leaf' });
        s.text(derived(() => 'seen:' + activity.get().lastSeen), { class: 'leaf', id: 'activity' });
      }));
      const handle = renderer.mount(compile(app), container());
      return { activity, handle };
    } });
  benchmarks.E_deepState = { leaves: 4, ...timing, nodesUpdated: writes,
    note: 'update one deep branch; nodesUpdated MUST be 1 of 4 leaves (fine-grained)' };
}

// F — SSR: renderToString time + output size.
{
  const compiled = compile(flatApp(N_BIG));
  let bytes = 0;
  const timing = measure(() => { bytes = Buffer.byteLength(renderToString(compiled), 'utf8'); },
    { iterations: 20, warmup: 5 });
  benchmarks.F_ssr = { nodes: N_BIG, ...timing, outputBytes: bytes,
    note: 'renderToString of a 10k-node app; output size in bytes' };
}

// G — Hydration (happy-dom substitute; real Chromium is BLOCKED, see browser-harness).
{
  const { adapter, counters } = makeCountingAdapter();
  const renderer = createRenderer({ domAdapter: adapter });
  let created = 0;
  const timing = measure((s) => {
    counters.reset();
    s.handle = renderer.hydrate(s.compiled, s.container);
    const snap = counters.snapshot();
    created = snap.createElement + snap.createTextNode;
  }, { iterations: 15, warmup: 4,
    setup: () => {
      const compiled = compile(flatApp(N_BIG));
      const c = container();
      c.innerHTML = renderToString(compiled);
      return { compiled, container: c };
    } });
  benchmarks.G_hydration = { nodes: N_BIG, ...timing, domNodesCreatedDuringHydration: created,
    environment: 'happy-dom (NOT a real browser)', realBrowser: 'BLOCKED: no Chromium/Playwright',
    note: 'adopts server DOM; domNodesCreatedDuringHydration should be ~0 for a matching tree' };
}

// H — Bundle size (raw / gzip / brotli) over the built artifacts.
{
  const zlib = await import('node:zlib');
  const path = await import('node:path');
  const here = path.dirname(new URL(import.meta.url).pathname);
  const repo = path.resolve(here, '..', '..');
  const sizeOf = (rel) => {
    const abs = path.join(repo, rel);
    if (!fs.existsSync(abs)) return null;
    const buf = fs.readFileSync(abs);
    return {
      file: rel,
      raw: buf.length,
      gzip: zlib.gzipSync(buf, { level: 9 }).length,
      brotli: zlib.brotliCompressSync(buf).length,
    };
  };
  benchmarks.H_bundleSize = {
    streetuiRuntime: sizeOf('packages/streetui/dist/index.js'),
    ssrSubset: sizeOf('packages/streetui/dist/server.js'),
    minimalApp: sizeOf('examples/streetui-basic-app/dist/index.js'),
    routerApp: sizeOf('examples/streetui-full-app/dist/routed.js'),
    fullApp: sizeOf('examples/streetui-full-app/dist/index.js'),
    note: 'sizes in bytes; gzip level 9; brotli default. Measured on built dist.',
  };
}

// ── emit spec-shaped result ──────────────────────────────────────────────────
const path = await import('node:path');
function arg(name, def = null) {
  const hit = process.argv.find((a) => a.startsWith('--' + name + '='));
  return hit ? hit.slice(name.length + 3) : def;
}
const { VERSION } = { VERSION: '1.1.0' };

const out = {
  streetuiVersion: '1.1.0',
  nodeVersion: process.version,
  browserVersion: null, // BLOCKED: no Chromium/Playwright in this environment
  commit: arg('commit', 'uncommitted'),
  timestamp: new Date().toISOString(),
  environment: {
    domEnvironment: 'happy-dom (Node) — relative deltas valid; absolute != browser',
    realBrowser: 'BLOCKED (no Chromium/Playwright)',
    cpu: os.cpus()[0]?.model ?? 'unknown',
    arch: process.arch,
    platform: process.platform,
  },
  benchmarks,
};

const outPath = arg('out', path.join(process.cwd(), 'v11-scenarios.out.json'));
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
process.stdout.write('scenarios written → ' + outPath + '\n');
process.stdout.write(JSON.stringify({
  A: benchmarks.A_initialRender.medianMs, B_ms: benchmarks.B_singleUpdate.medianMs,
  B_mut: benchmarks.B_singleUpdate.domMutations, D10k: benchmarks.D_fanOut['subscribers=10000'].medianMs,
  E_upd: benchmarks.E_deepState.nodesUpdated, F_ms: benchmarks.F_ssr.medianMs,
  G_created: benchmarks.G_hydration.domNodesCreatedDuringHydration,
  runtimeGzip: benchmarks.H_bundleSize.streetuiRuntime?.gzip,
}, null, 2) + '\n');

