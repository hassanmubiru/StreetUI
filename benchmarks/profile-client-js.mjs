/**
 * StreetUI v1.8 — CLIENT-JS profiling harness (spec §6/§7/§8/§10).
 *
 * IMPORTANT HONESTY CONTRACT:
 *   This runs under Node + happy-dom. It is NOT a browser. It cannot measure
 *   paint, layout, style recalc, compositor, real long tasks, or true frame
 *   pacing. Its ONLY legitimate use is to attribute *JavaScript self-time*
 *   between StreetUI-controlled functions and the (happy-dom) DOM adapter, so we
 *   can see which StreetUI JS is worth profiling in a real browser later. No
 *   number here is a browser number and none may be presented as one.
 *
 * It mounts the real performance-app /users route (10k keyed rows) repeatedly
 * under --cpu-prof. A sibling parser (profile-parse.mjs) reads the emitted
 * .cpuprofile and buckets self-time by source file, separating
 * streetui/packages/* from happy-dom and node core.
 *
 * Usage:
 *   node --cpu-prof --cpu-prof-dir=<dir> --cpu-prof-name=client.cpuprofile \
 *        benchmarks/profile-client-js.mjs
 */
import path from 'node:path';
import { Window } from 'happy-dom';

const win = new Window({ url: 'http://localhost/' });
for (const k of ['document', 'Node', 'Element', 'HTMLElement', 'Text', 'Comment',
  'DocumentFragment', 'Event', 'CustomEvent', 'MutationObserver']) {
  globalThis[k] = k === 'document' ? win.document : win[k];
}
globalThis.window = win;
globalThis.requestAnimationFrame = (fn) => setTimeout(() => fn(performance.now()), 0);

const W = process.env.W ?? path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const appDist = path.join(W, 'examples', 'streetui-performance-app', 'dist');
const { compilePage, createDeps } = await import(path.join(appDist, 'index.js'));
const {
  BrowserDOMAdapter, createRenderContext, mountGraph,
} = await import('streetui');

// Build the 10k-row users route once (compile excluded from the profiled region).
const compiled = compilePage(createDeps({ sizing: { rows: 10000 } }), 'users', { name: 'light' });

function mountOnce() {
  const dom = new BrowserDOMAdapter();
  const container = document.createElement('div');
  const ctx = createRenderContext(dom, compiled.graph, container);
  const rt = mountGraph(ctx);
  return { rt, ctx, container };
}

// ── Profiled region ─────────────────────────────────────────────────────────
// Repeat mounts so the profiler collects enough samples to attribute self-time.
const REPEATS = Number(process.env.REPEATS ?? 6);
let sink = 0;
for (let i = 0; i < REPEATS; i++) {
  const { rt, container } = mountOnce();
  sink += container.childNodes.length;
  rt.dispose();
}
process.stdout.write(`profile-client-js: mounted ${REPEATS}x 10k-row users route (sink=${sink}). ` +
  `Node+happy-dom JS self-time captured for parsing - NOT a browser measurement.\n`);
