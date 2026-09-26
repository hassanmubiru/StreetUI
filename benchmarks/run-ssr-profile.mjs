/**
 * StreetUI v1.7 — Static SSR benchmark (spec §16/§17/§18/§19). Node-only.
 *
 * Measures the compile-time static-subtree plan against the v1.6 runtime path
 * on the SAME compiled applications, all in one process. Terminology:
 *   v16    = renderToString(compiled, { staticPlan: null })   // v1.6 runtime mount
 *   v17warm= renderToString(compiled)                         // plan already cached
 *   v17cold= renderToString(freshCompiled)                    // plan built this render
 *            (cold uses a distinct CompiledApplication per iteration, pre-compiled
 *             outside the timed region, so compile cost is excluded and only the
 *             one-time plan build is included.)
 *
 * The static plan is built once per CompiledApplication and cached (WeakMap), so
 * v17warm models a production SSR server: compile once at boot, renderToString
 * per request. v17cold models the very first request that triggers the build.
 *
 * Every number is measured here. Output: JSON on stdout (__SSRPROFILE__) + an
 * optional --out=<absPath>. Run with --expose-gc for the memory section.
 *
 * Usage: node --expose-gc benchmarks/run-ssr-profile.mjs [--out=<absPath>]
 */
import { performance } from 'node:perf_hooks';
import path from 'node:path';
import fs from 'node:fs';
import { Window } from 'happy-dom';

const win = new Window({ url: 'http://localhost/' });
for (const k of ['document', 'Node', 'Element', 'HTMLElement', 'Text', 'Comment',
  'DocumentFragment', 'Event', 'CustomEvent']) {
  globalThis[k] = k === 'document' ? win.document : win[k];
}
globalThis.window = win;

const W = process.env.W ?? path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const appDist = path.join(W, 'examples', 'streetui-performance-app', 'dist');
const { compilePage, createDeps } = await import(path.join(appDist, 'index.js'));
const { renderToString, ServerDOMAdapter, createRenderContext, mountGraph, serializeChildren } =
  await import('streetui');

const gc = () => { try { globalThis.gc?.(); } catch { /* no --expose-gc */ } };
const r4 = (x) => Math.round(x * 1e4) / 1e4;
const hasGc = typeof globalThis.gc === 'function';

function stats(fn, { warmup = 3, iterations = 15 } = {}) {
  for (let i = 0; i < warmup; i++) { fn(); gc(); }
  const s = [];
  for (let i = 0; i < iterations; i++) {
    const t = performance.now();
    fn();
    s.push(performance.now() - t);
    gc();
  }
  s.sort((a, b) => a - b);
  return {
    medianMs: r4(s[Math.floor(s.length / 2)]),
    p95Ms: r4(s[Math.min(s.length - 1, Math.ceil(0.95 * s.length) - 1)]),
    minMs: r4(s[0]), maxMs: r4(s[s.length - 1]), samples: s.length,
  };
}

// Cold stats: a distinct pre-compiled app per timed render (plan not yet built).
function statsCold(buildCompiled, { warmup = 2, iterations = 10 } = {}) {
  const pool = [];
  for (let i = 0; i < warmup + iterations; i++) pool.push(buildCompiled());
  let k = 0;
  for (let i = 0; i < warmup; i++) { renderToString(pool[k++]); gc(); }
  const s = [];
  for (let i = 0; i < iterations; i++) {
    const c = pool[k++];
    const t = performance.now();
    renderToString(c);
    s.push(performance.now() - t);
    gc();
  }
  s.sort((a, b) => a - b);
  return {
    medianMs: r4(s[Math.floor(s.length / 2)]),
    p95Ms: r4(s[Math.min(s.length - 1, Math.ceil(0.95 * s.length) - 1)]),
    minMs: r4(s[0]), maxMs: r4(s[s.length - 1]), samples: s.length,
  };
}

// v1.6 phase split (public building blocks): mount (build ServerDOM tree) then
// serialize the already-built tree.
function v16Phases(compiled, opts) {
  const mount = stats(() => {
    const d = new ServerDOMAdapter();
    const c = d.createElement('div');
    const ctx = createRenderContext(d, compiled.graph, c);
    const rt = mountGraph(ctx);
    rt.dispose(); ctx.instances.clear();
  }, opts);
  let serialize;
  {
    const d = new ServerDOMAdapter();
    const c = d.createElement('div');
    const ctx = createRenderContext(d, compiled.graph, c);
    const rt = mountGraph(ctx);
    serialize = stats(() => serializeChildren(c), opts);
    rt.dispose(); ctx.instances.clear();
  }
  return { mount, serialize };
}

// ── §16 SSR row-count matrix ────────────────────────────────────────────────
const matrix = [];
for (const rows of [10, 100, 1000, 5000, 10000]) {
  const iters = rows >= 5000 ? 12 : 15;
  const compiled = compilePage(createDeps({ sizing: { rows } }), 'users', { name: 'light' });
  const body = renderToString(compiled); // warms the cached plan
  const bytes = Buffer.byteLength(body, 'utf8');

  const v16 = stats(() => renderToString(compiled, { staticPlan: null }), { iterations: iters });
  const v17warm = stats(() => renderToString(compiled), { iterations: iters });
  const v17cold = statsCold(
    () => compilePage(createDeps({ sizing: { rows } }), 'users', { name: 'light' }),
    { iterations: Math.min(iters, 8) },
  );
  const { mount: v16mount, serialize: v16serialize } = v16Phases(compiled, { iterations: iters });
  const planBuildMs = r4(Math.max(0, v17cold.medianMs - v17warm.medianMs));

  matrix.push({
    rows, bytes,
    v16TotalMs: v16,
    v17WarmTotalMs: v17warm,
    v17ColdTotalMs: v17cold,
    v16MountMs: v16mount,
    v16SerializeMs: v16serialize,
    planBuildMsApprox: planBuildMs,
    warmSpeedupX: r4(v16.medianMs / v17warm.medianMs),
  });
  console.log(
    `rows=${String(rows).padStart(5)} bytes=${String(bytes).padStart(8)} ` +
    `v16=${v16.medianMs}ms v17warm=${v17warm.medianMs}ms v17cold=${v17cold.medianMs}ms ` +
    `planBuild≈${planBuildMs}ms warmSpeedup=${r4(v16.medianMs / v17warm.medianMs)}x`,
  );
}

// ── §17 A/B on representative scenarios ─────────────────────────────────────
const SCENARIOS = [
  { name: 'mostly-static (users 2k rows)', view: 'users', sizing: { rows: 2000 } },
  { name: 'mixed (controls, 1k toggles)', view: 'controls', sizing: undefined },
  { name: 'highly-dynamic (dashboard)', view: 'dashboard', sizing: undefined },
  { name: 'large-list (users 10k rows)', view: 'users', sizing: { rows: 10000 } },
];

// Allocation pressure: heapUsed delta over N renders (gc once up-front, none in
// between). Approximate — indicative of churn, not an authoritative allocation
// count. Only meaningful with --expose-gc.
function allocPerRender(fn, n = 20) {
  if (!hasGc) return null;
  gc();
  const before = process.memoryUsage().heapUsed;
  for (let i = 0; i < n; i++) fn();
  const after = process.memoryUsage().heapUsed;
  return { nRenders: n, heapDeltaBytes: after - before, bytesPerRender: Math.round((after - before) / n) };
}

const abResults = [];
for (const sc of SCENARIOS) {
  const compiled = compilePage(createDeps(sc.sizing ? { sizing: sc.sizing } : {}), sc.view, { name: 'light' });
  const body = renderToString(compiled); // warm plan
  const bytes = Buffer.byteLength(body, 'utf8');

  const v16 = stats(() => renderToString(compiled, { staticPlan: null }));
  const v17warm = stats(() => renderToString(compiled));
  const v17cold = statsCold(
    () => compilePage(createDeps(sc.sizing ? { sizing: sc.sizing } : {}), sc.view, { name: 'light' }),
    { iterations: 8 },
  );
  const { mount: v16mount, serialize: v16serialize } = v16Phases(compiled);

  const allocV16 = allocPerRender(() => renderToString(compiled, { staticPlan: null }));
  const allocV17 = allocPerRender(() => renderToString(compiled));

  abResults.push({
    scenario: sc.name,
    outputBytes: bytes,
    v16: { totalMs: v16, mountMs: v16mount, serializeMs: v16serialize, allocPerRender: allocV16 },
    v17: { warmTotalMs: v17warm, coldTotalMs: v17cold, allocPerRender: allocV17 },
    warmSpeedupX: r4(v16.medianMs / v17warm.medianMs),
    outputBytesIdentical: true, // enforced by verify-ssr-hashes gate
  });
  console.log(
    `AB ${sc.name.padEnd(30)} v16=${v16.medianMs}ms v17warm=${v17warm.medianMs}ms ` +
    `v17cold=${v17cold.medianMs}ms warmSpeedup=${r4(v16.medianMs / v17warm.medianMs)}x`,
  );
}

// ── §18 compile + plan-build overhead (small/medium/large) ──────────────────
const compileOverhead = [];
for (const [label, rows] of [['small', 10], ['medium', 1000], ['large', 10000]]) {
  const compileMs = stats(
    () => compilePage(createDeps({ sizing: { rows } }), 'users', { name: 'light' }),
    { iterations: 10 },
  );
  const compiled = compilePage(createDeps({ sizing: { rows } }), 'users', { name: 'light' });
  renderToString(compiled); // warm
  const warm = stats(() => renderToString(compiled), { iterations: 12 });
  const cold = statsCold(
    () => compilePage(createDeps({ sizing: { rows } }), 'users', { name: 'light' }),
    { iterations: 8 },
  );
  compileOverhead.push({
    size: label, rows,
    compileMs,
    v17WarmRenderMs: warm,
    v17ColdRenderMs: cold,
    planBuildMsApprox: r4(Math.max(0, cold.medianMs - warm.medianMs)),
    note: 'compile() unchanged from v1.6; the static plan is built lazily on first renderToString (getStaticSSRPlan), reflected in cold−warm.',
  });
}

// ── §19 memory over repeated renders ────────────────────────────────────────
const memory = { available: hasGc, samples: [] };
if (hasGc) {
  const compiled = compilePage(createDeps({ sizing: { rows: 10000 } }), 'users', { name: 'light' });
  renderToString(compiled); // build + cache plan once
  for (const n of [50, 100, 200]) {
    gc(); const before = process.memoryUsage().heapUsed;
    for (let i = 0; i < n; i++) renderToString(compiled);
    gc(); const after = process.memoryUsage().heapUsed;
    memory.samples.push({
      renders: n,
      heapBeforeMB: r4(before / 1048576),
      heapAfterMB: r4(after / 1048576),
      retainedDeltaMB: r4((after - before) / 1048576),
    });
    console.log(`mem renders=${n} retainedDelta=${r4((after - before) / 1048576)}MB`);
  }
  memory.note =
    'Same cached-plan compiled app rendered N times. Plan (strings only, ~output size) is built once and reused; ' +
    'per-render ServerRawHTML nodes + output string are transient. Stable retainedDelta ⇒ no per-render leak, no app/DOM retention (WeakMap-keyed plan).';
}

const out = {
  benchmark: 'run-ssr-profile',
  spec: '§16/§17/§18/§19',
  generatedAt: new Date().toISOString(),
  environment: {
    runtime: `node ${process.version}`,
    exposeGc: hasGc,
    dom: 'ServerDOMAdapter (no browser; happy-dom only for module-load globals)',
    note: 'Node measurement. NOT a browser number. Do not compare against Chromium/competitors.',
    terminology: 'v16=renderToString(compiled,{staticPlan:null}); v17warm=cached plan; v17cold=fresh compiled per render (plan built that render, compile excluded).',
  },
  ssrMatrix: matrix,
  abScenarios: abResults,
  compileOverhead,
  memory,
};

const outFlag = process.argv.find((a) => a.startsWith('--out='));
if (outFlag) {
  const p = outFlag.slice('--out='.length);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(out, null, 2));
}
console.log('__SSRPROFILE__' + JSON.stringify(out));

