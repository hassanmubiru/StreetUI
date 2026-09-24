/**
 * In-browser measurement harness for the real performance app (spec §4–§7).
 *
 * This module is browser-only: it uses `performance.now`, `PerformanceObserver`
 * (long-task + event timing), `MutationObserver` (to count real DOM mutations),
 * `requestAnimationFrame` (frame pacing vs the 16.67 ms / 8.33 ms reference
 * budgets — reported as reference points, NOT as a frame-rate guarantee), and the
 * `performance.memory` heap counters when the engine exposes them.
 *
 * It installs `window.__bench`, an async function returning a structured result
 * object. `scripts/browser-harness.mjs` drives it through Playwright/Chromium and
 * records the numbers to `benchmarks/results/v1.3/streetui-browser.json`. When no
 * Chromium binary is present the harness records BLOCKED instead — it never
 * fabricates these numbers, and happy-dom (Node) is never substituted for them,
 * because happy-dom cannot measure paint, layout, long tasks, or true frame time.
 */
import { mountPerfApp } from './routed.js';
import { hydrateApp } from './browser-entry.js';
import { renderIsland } from './server-entry.js';
import { createDeps } from './deps.js';

interface FrameStats { frames: number; maxFrameMs: number; longFrames60: number; longFrames120: number; }
interface OpResult { ms: number; domMutations: number; }

declare global {
  interface Window { __bench?: () => Promise<unknown>; }
  interface Performance { memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number }; }
}

const now = (): number => performance.now();
const nextFrame = (): Promise<number> =>
  new Promise((r) => requestAnimationFrame(() => r(performance.now())));
const settle = async (): Promise<void> => { await nextFrame(); await nextFrame(); };

/** Count real DOM mutations produced by `op` on `root`, and time it. */
async function measureOp(root: Node, op: () => void): Promise<OpResult> {
  let count = 0;
  const obs = new MutationObserver((records) => {
    for (const r of records) {
      count += r.addedNodes.length + r.removedNodes.length;
      if (r.type === 'attributes' || r.type === 'characterData') count += 1;
    }
  });
  obs.observe(root, { childList: true, subtree: true, attributes: true, characterData: true });
  const t0 = now();
  op();
  const ms = now() - t0;
  await settle();
  obs.disconnect();
  return { ms, domMutations: count };
}

/** Sample frame pacing for `durationMs` while `drive` mutates the UI. */
async function measureFrames(durationMs: number, drive: (i: number) => void): Promise<FrameStats> {
  let frames = 0, maxFrameMs = 0, longFrames60 = 0, longFrames120 = 0, i = 0;
  let last = await nextFrame();
  const end = last + durationMs;
  for (;;) {
    drive(i++);
    const t = await nextFrame();
    const dt = t - last; last = t; frames++;
    if (dt > maxFrameMs) maxFrameMs = dt;
    if (dt > 16.67) longFrames60++;
    if (dt > 8.33) longFrames120++;
    if (t >= end) break;
  }
  return { frames, maxFrameMs: Math.round(maxFrameMs * 100) / 100, longFrames60, longFrames120 };
}

function heap(): number | null {
  return typeof performance.memory?.usedJSHeapSize === 'number' ? performance.memory.usedJSHeapSize : null;
}

async function run(): Promise<unknown> {
  // ── long-task observer spanning the whole run ──────────────────────────────
  const longTasks: number[] = [];
  let lto: PerformanceObserver | null = null;
  try {
    lto = new PerformanceObserver((list) => { for (const e of list.getEntries()) longTasks.push(e.duration); });
    lto.observe({ entryTypes: ['longtask'] });
  } catch { lto = null; }

  const host = document.createElement('div');
  document.body.appendChild(host);

  // A — initial mount of the 10,000-row users view (real paint path) ──────────
  const tMount0 = now();
  let app = mountPerfApp(host, { path: '/users', deps: createDeps() });
  const initialMountMs = now() - tMount0;
  await settle();
  const domNodeCount = host.querySelectorAll('*').length;

  // C — reactive search over 10k rows (mutation count + time) ─────────────────
  const searchNarrow = await measureOp(host, () => app.deps.query.set('aa'));
  const searchClear = await measureOp(host, () => app.deps.query.set(''));

  // reverse (worst-case reorder) ──────────────────────────────────────────────
  const reverse = await measureOp(host, () => app.deps.sortDir.set('desc'));

  // frame pacing while repeatedly toggling sort direction on the big list ─────
  const listFrames = await measureFrames(500, (i) => app.deps.sortDir.set(i % 2 ? 'asc' : 'desc'));
  app.unmount();

  // F — fine-grained: toggle 1 of 1000 controls (mutation count) ──────────────
  app = mountPerfApp(host, { path: '/', deps: createDeps() });
  const ctrlHost = document.createElement('div');
  document.body.appendChild(ctrlHost);
  const ctrlApp = mountPerfApp(ctrlHost, { path: '/', deps: createDeps() });
  ctrlApp.router.navigate('/settings'); // ensure shell built
  const toggleOne = await measureOp(ctrlHost, () => ctrlApp.deps.pushToggle(500));
  ctrlApp.unmount(); ctrlHost.remove();

  // D — router navigation timing across real routes ───────────────────────────
  const navMs: number[] = [];
  for (const to of ['/dashboard', '/users', '/settings', '/']) {
    const t0 = now(); app.router.navigate(to); await settle(); navMs.push(now() - t0);
  }
  app.unmount();

  // G — hydration of the SSR users view: must adopt DOM (no added nodes) ──────
  const island = renderIsland({ view: 'users' });
  const hydHost = document.createElement('div');
  hydHost.innerHTML = island.html;
  document.body.appendChild(hydHost);
  const appNode = hydHost.querySelector('#app') as Element;
  const beforeCount = appNode.querySelectorAll('*').length;
  const hyd = await measureOp(appNode, () => {
    const h = hydrateApp(appNode, { stateRoot: hydHost, view: 'users' });
    (hydHost as unknown as { __h?: unknown }).__h = h;
  });
  const afterCount = appNode.querySelectorAll('*').length;
  ((hydHost as unknown as { __h?: { unmount(): void } }).__h)?.unmount();
  hydHost.remove();

  // §7 — memory across mount → interact → unmount cycles ──────────────────────
  const heapBefore = heap();
  const heapSamples: (number | null)[] = [];
  for (let c = 0; c < 6; c++) {
    const h = document.createElement('div'); document.body.appendChild(h);
    const a = mountPerfApp(h, { path: '/users', deps: createDeps({ sizing: { rows: 2000, controls: 200 } }) });
    a.deps.query.set('a'); a.deps.query.set('');
    a.router.navigate('/settings'); a.router.navigate('/');
    a.unmount(); h.remove();
    await settle();
    heapSamples.push(heap());
  }
  const heapAfter = heap();

  lto?.disconnect();
  host.remove();

  const ref = { frame60Ms: 16.67, frame120Ms: 8.33 };
  return {
    initialMountUsers10k: { ms: Math.round(initialMountMs * 100) / 100, domNodeCount },
    reactiveSearch: { narrow: searchNarrow, clear: searchClear },
    reverse,
    fineGrainedToggle1of1000: toggleOne,
    routerNavigationMs: navMs.map((m) => Math.round(m * 100) / 100),
    hydrateUsers10k: {
      ms: Math.round(hyd.ms * 100) / 100,
      nodesBefore: beforeCount, nodesAfter: afterCount,
      addedDuringHydration: hyd.domMutations,
      adoptedWithoutRecreating: afterCount === beforeCount,
    },
    frames: { budgetReference: ref, bigListReorder: listFrames },
    memory: {
      available: heapBefore !== null,
      usedJSHeapBefore: heapBefore, usedJSHeapAfter: heapAfter, perCycle: heapSamples,
      note: 'Browsers expose no explicit GC; heap deltas are indicative, not authoritative.',
    },
    longTasks: { count: longTasks.length, totalMs: Math.round(longTasks.reduce((a, b) => a + b, 0) * 100) / 100 },
  };
}

window.__bench = run;
export { run };
