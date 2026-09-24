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
// PLACEHOLDER_SCENARIOS
