/**
 * Shared scenario core — framework-agnostic measurement engine.
 * Expects window.__adapter = { mount, update, teardown, signal?, ssr? }
 * set by each framework adapter before this runs.
 */

const raf = () => new Promise(r => requestAnimationFrame(() => r()));
const paint = async () => { await raf(); await raf(); };

function makeMutationCounter(container) {
  let count = 0;
  const mo = new MutationObserver(records => {
    for (const r of records)
      count += r.addedNodes.length + r.removedNodes.length +
        (r.type === 'attributes' || r.type === 'characterData' ? 1 : 0);
  });
  mo.observe(container, { childList: true, subtree: true, attributes: true, characterData: true });
  return { get: () => count, stop: () => { mo.takeRecords(); mo.disconnect(); } };
}

function makeLongTaskObserver() {
  const tasks = [];
  let po = null;
  try {
    po = new PerformanceObserver(list => { for (const e of list.getEntries()) tasks.push(Math.round(e.duration)); });
    po.observe({ entryTypes: ['longtask'] });
  } catch {}
  return { get: () => tasks.slice(), stop: () => po?.disconnect() };
}

async function measure(label, container, fn) {
  const mc = makeMutationCounter(container);
  const t0 = performance.now();
  await fn();
  await paint();
  const durationMs = Math.round((performance.now() - t0) * 100) / 100;
  mc.stop();
  return { label, durationMs, domMutations: mc.get(), nodeCount: container.querySelectorAll('*').length };
}

async function runAll(container, model) {
  const adapter = window.__adapter;
  if (!adapter) throw new Error('no adapter: window.__adapter not set');
  const lt = makeLongTaskObserver();
  const results = {};

  // Initial render
  results.initialRender = await measure('initial-render', container, () => adapter.mount(container, model));

  // Single reactive update
  if (adapter.update) {
    results.singleUpdate = await measure('single-update', container, () => adapter.update(model));
  }

  // List ops — only if adapter.listOps exists
  if (adapter.listOps) {
    results.listOps = {};
    for (const [op, fn] of Object.entries(adapter.listOps)) {
      results.listOps[op] = await measure(op, container, fn);
    }
  }

  // Frame pacing — 500ms of repeated updates
  if (adapter.update) {
    let frames = 0, maxFrameMs = 0, dropped = 0;
    const end = performance.now() + 500;
    let last = performance.now();
    let i = 0;
    while (performance.now() < end) {
      adapter.update(model, i++);
      const t = await raf();
      const dt = t - last; last = t; frames++;
      if (dt > maxFrameMs) maxFrameMs = dt;
      if (dt > 24) dropped++;
    }
    results.framePacing = { frames, maxFrameMs: Math.round(maxFrameMs * 10) / 10, droppedFrames: dropped };
  }

  // SSR (only if adapter provides it — string returned)
  if (adapter.ssr) {
    const t0 = performance.now();
    const html = adapter.ssr(model);
    results.ssr = { durationMs: Math.round((performance.now() - t0) * 100) / 100, bytes: html.length };
  }

  // Hydration
  if (adapter.hydrate) {
    const html = adapter.ssr ? adapter.ssr(model) : '';
    container.innerHTML = html;
    results.hydration = await measure('hydration', container, () => adapter.hydrate(container, model));
  }

  // Teardown
  if (adapter.teardown) adapter.teardown();

  lt.stop();
  results.longTasks = lt.get();
  return results;
}

window.__run = async () => runAll(document.getElementById('app'), window.__model);
