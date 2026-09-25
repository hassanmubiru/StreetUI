/**
 * StreetUI v1.4 — SSR profiling harness (§12). Node-only; NO browser needed.
 *
 * Measures renderToString + serializeState timing per real-app route, and
 * isolates the HTML-escape cost (the suspected string-allocation hotspot for
 * §14) by micro-benchmarking the escape functions on the ACTUAL serialized
 * body text of the 10k-row /users route.
 *
 * Every number printed is measured in this process. Output: JSON on stdout
 * (prefixed __SSRPROF__) so the orchestrator can persist it.
 *
 * Usage: node --expose-gc benchmarks/ssr-profile.mjs [--out=<absPath>]
 */
import { performance } from 'node:perf_hooks';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Window } from 'happy-dom';

// happy-dom globals so createDeps/compilePage (which may reference DOM types at
// module load) never throw; SSR itself uses the ServerDOMAdapter, not this.
const win = new Window({ url: 'http://localhost/' });
for (const k of ['document', 'Node', 'Element', 'HTMLElement', 'Text', 'Comment',
  'DocumentFragment', 'Event', 'CustomEvent']) {
  globalThis[k] = k === 'document' ? win.document : win[k];
}
globalThis.window = win;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDist = path.resolve(__dirname, '..', 'examples', 'streetui-performance-app', 'dist');
const { renderIsland } = await import(path.join(appDist, 'server-entry.js'));
const { compilePage, createDeps } = await import(path.join(appDist, 'index.js'));
const streetui = await import('streetui');
const { renderToString, serializeState } = streetui;

const gc = () => { try { globalThis.gc?.(); } catch { /* no --expose-gc */ } };
const round = (x) => Math.round(x * 1e4) / 1e4;

function measure(fn, { warmup = 3, iterations = 15, setup } = {}) {
  for (let i = 0; i < warmup; i++) { fn(setup?.()); gc(); }
  const s = [];
  for (let i = 0; i < iterations; i++) {
    const arg = setup?.();
    const t0 = performance.now();
    fn(arg);
    s.push(performance.now() - t0);
    gc();
  }
  s.sort((a, b) => a - b);
  return {
    medianMs: round(s[Math.floor(s.length / 2)]),
    p95Ms: round(s[Math.min(s.length - 1, Math.ceil(0.95 * s.length) - 1)]),
    minMs: round(s[0]), maxMs: round(s[s.length - 1]), samples: s.length,
  };
}

// PLACEHOLDER_BODY
