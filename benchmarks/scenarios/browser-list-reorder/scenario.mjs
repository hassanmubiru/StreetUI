/**
 * §2 — Isolated list-reorder benchmark, in-page measurement core.
 *
 * Framework-AGNOSTIC. This file measures; it does not know about any framework.
 * A per-framework adapter (see ./adapters/) supplies three hooks on `window`:
 *
 *   window.__bench = {
 *     mount(container, count)      // build a keyed list of `count` rows, return when painted
 *     apply(op)                    // apply one operation to the CURRENT list, return when painted
 *     teardown()                   // unmount + release
 *   }
 *
 * The core drives a fixed operation script over a 10,000-row keyed list and records,
 * for each op: wall duration (performance.now around apply + a double-rAF paint wait),
 * DOM mutations (MutationObserver on the container subtree), resulting node count, long
 * tasks (PerformanceObserver 'longtask'), and dropped frames (rAF interval sampling).
 *
 * Every number this produces comes from the real engine it runs in. It is only ever
 * executed by ./run.mjs, which first proves a Chromium binary + Playwright are present;
 * with no browser (this VM), run.mjs records the result BLOCKED and this core never runs.
 */
'use strict';

export const ROW_COUNT = 10_000;

/** The fixed, deterministic operation script (each mutates the current list). */
export const OPERATIONS = [
  { name: 'create10k', kind: 'mount' },
  { name: 'append 1k', kind: 'append', n: 1_000 },
  { name: 'prepend 1k', kind: 'prepend', n: 1_000 },
  { name: 'insertMiddle 1k', kind: 'insertMiddle', n: 1_000 },
  { name: 'removeScattered 1k', kind: 'removeScattered', n: 1_000 },
  { name: 'swapEnds', kind: 'swap' },
  { name: 'reverse', kind: 'reverse' },
  { name: 'shuffle', kind: 'shuffle', seed: 0x9e3779b9 },
  { name: 'updateEvery10th', kind: 'update', stride: 10 },
];

const raf = () => new Promise((r) => requestAnimationFrame(() => r()));
const paint = async () => { await raf(); await raf(); }; // two frames ⇒ committed paint

function makeFrameSampler() {
  let last = performance.now();
  let dropped = 0, frames = 0;
  let stop = false;
  const tick = () => {
    if (stop) return;
    const now = performance.now();
    const dt = now - last; last = now; frames++;
    if (dt > 24) dropped++; // >~1.5×16.7ms ⇒ a dropped frame at 60Hz
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return { end() { stop = true; return { frames, droppedFrames: dropped }; } };
}

export async function runListReorder(container) {
  if (!globalThis.__bench) throw new Error('no framework adapter: window.__bench is undefined');

  const longTasks = [];
  let po;
  try {
    po = new PerformanceObserver((list) => { for (const e of list.getEntries()) longTasks.push(Math.round(e.duration)); });
    po.observe({ entryTypes: ['longtask'] });
  } catch { /* longtask not supported ⇒ recorded as null below */ }

  const results = [];
  const sampler = makeFrameSampler();

  for (const op of OPERATIONS) {
    const mo = new MutationObserver(() => {});
    mo.observe(container, { childList: true, subtree: true, attributes: true, characterData: true });

    const before = longTasks.length;
    const t0 = performance.now();
    if (op.kind === 'mount') await globalThis.__bench.mount(container, ROW_COUNT);
    else await globalThis.__bench.apply(op);
    await paint();
    const durationMs = Math.round((performance.now() - t0) * 100) / 100;

    const records = mo.takeRecords(); mo.disconnect();
    let mutations = 0;
    for (const r of records) mutations += r.addedNodes.length + r.removedNodes.length + (r.type === 'attributes' || r.type === 'characterData' ? 1 : 0);

    results.push({
      op: op.name,
      durationMs,
      domMutations: mutations,
      nodeCount: container.querySelectorAll('*').length,
      longTasksDuringOp: po ? longTasks.length - before : null,
    });
  }

  const frames = sampler.end();
  po?.disconnect();
  globalThis.__bench.teardown?.();

  return {
    rowCount: ROW_COUNT,
    operations: results,
    longTaskDurationsMs: po ? longTasks : null,
    framePacing: frames,
    note: 'Real-engine measurement. Values are meaningful ONLY from a real browser; never run under happy-dom.',
  };
}
