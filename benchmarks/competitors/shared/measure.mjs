// DEV-ONLY benchmark artifact — cross-framework competitor harness. NOT part of the `streetui` runtime.
/**
 * Shared timing + DOM-mutation instrumentation for the competitor benchmark
 * harness. This mirrors the statistics used by the StreetUI harness
 * (`packages/benchmarks/v11-scenarios.mjs`) so competitor numbers are directly
 * comparable: same warmup discard, same median (floor(len/2)) and p95
 * (ceil(0.95*len)-1) selection, same 4-decimal rounding.
 *
 * It is intentionally isomorphic (Node + browser):
 *   - timing uses `globalThis.performance.now()` (present in Node 22+ and every
 *     browser), so this module imports cleanly into a Vite browser bundle
 *     WITHOUT pulling in `node:perf_hooks`.
 *   - DOM-mutation counting uses the browser `MutationObserver` and is only
 *     exercised from the in-browser scenarios (A/B/C/D/E/G).
 *
 * Unlike the StreetUI harness, `measure()` here is async-capable: several
 * competitors commit DOM asynchronously (Vue `nextTick`, Svelte `tick`), so a
 * fair "update duration" must await the point at which the DOM is actually
 * committed. Synchronous frameworks (React via `flushSync`, Solid) simply
 * resolve immediately. The statistics are otherwise identical to StreetUI's.
 */

const now = () => globalThis.performance.now();

/** Round to 4 decimals, matching the StreetUI harness `round()`. */
export const round = (x) => Math.round(x * 1e4) / 1e4;

/**
 * Run `fn` `iterations` times (after `warmup` discarded runs) and return the
 * timing summary. `fn` may be sync or async; if `setup` is provided it is
 * invoked before each timed run and its return value is passed to `fn` (the
 * setup cost is NOT included in the measurement, matching StreetUI).
 *
 * @param {(state:any)=>void|Promise<void>} fn
 * @param {{warmup?:number, iterations?:number, setup?:()=>any}} [opts]
 */
export async function measure(fn, { warmup = 5, iterations = 25, setup } = {}) {
  for (let i = 0; i < warmup; i++) {
    const s = setup?.();
    await fn(s);
  }
  const samples = [];
  for (let i = 0; i < iterations; i++) {
    const s = setup?.();
    const t0 = now();
    await fn(s);
    samples.push(now() - t0);
  }
  samples.sort((a, b) => a - b);
  const med = samples[Math.floor(samples.length / 2)];
  const p95 = samples[Math.min(samples.length - 1, Math.ceil(0.95 * samples.length) - 1)];
  return {
    medianMs: round(med),
    p95Ms: round(p95),
    minMs: round(samples[0]),
    maxMs: round(samples[samples.length - 1]),
    samples: samples.length,
  };
}

/**
 * Count every element + text node in `el`'s subtree (inclusive). Used as the
 * fair analogue of StreetUI's `createElement + createTextNode` count for the
 * initial-render scenario (A): both express "how many DOM nodes now exist".
 */
export function countDomNodes(el) {
  let n = 0;
  const walk = (node) => {
    // ELEMENT_NODE (1) and TEXT_NODE (3) only — comments/attrs excluded, matching
    // the StreetUI createElement+createTextNode tally.
    if (node.nodeType === 1 || node.nodeType === 3) n++;
    for (let c = node.firstChild; c; c = c.nextSibling) walk(c);
  };
  walk(el);
  return n;
}

/**
 * A DOM-mutation counter built on MutationObserver, giving the browser-side
 * analogue of the StreetUI counting DOMAdapter. `takeRecords()` is used to
 * drain pending records synchronously after an update has committed, so the
 * count is exact and not subject to observer callback batching.
 *
 * The `total` returned by `stop()` mirrors StreetUI's `structuralWrites()`:
 *   characterData (text writes)
 *   + added nodes (appendChild/insertBefore)
 *   + removed nodes (removeChild)
 *   + attribute writes (setAttribute/removeAttribute).
 */
export function createMutationCounter(root) {
  const counts = { characterData: 0, added: 0, removed: 0, attributes: 0 };
  const observer = new MutationObserver(() => {});
  const consume = (records) => {
    for (const r of records) {
      if (r.type === 'characterData') counts.characterData++;
      else if (r.type === 'attributes') counts.attributes++;
      else if (r.type === 'childList') {
        counts.added += r.addedNodes.length;
        counts.removed += r.removedNodes.length;
      }
    }
  };
  return {
    start() {
      for (const k of Object.keys(counts)) counts[k] = 0;
      observer.observe(root, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
      });
    },
    /** Drain and stop; returns the counts including a StreetUI-style `total`. */
    stop() {
      consume(observer.takeRecords());
      observer.disconnect();
      const total = counts.characterData + counts.added + counts.removed + counts.attributes;
      return { ...counts, total };
    },
  };
}

/**
 * Convenience: fresh detached-then-attached container appended to <body>.
 * Attached (not detached) so layout/paint costs are realistic in-browser.
 */
export function makeContainer() {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

/** The 8 canonical workload sizes/labels, shared by every framework harness. */
export const N_BIG = 10000;
export const FANOUT_SIZES = [1000, 10000];
export const LIST_OPS = [
  'append',
  'prepend',
  'remove-first',
  'remove-middle',
  'remove-last',
  'reorder',
  'reverse',
  'update-item',
];

/** Build the canonical keyed-list dataset (id + label), matching StreetUI's `makeItems`. */
export const makeItems = (n, off = 0) =>
  Array.from({ length: n }, (_, i) => ({ id: i + off, label: `item-${i + off}` }));

/**
 * Pure list transforms shared by every framework's scenario C, identical to the
 * StreetUI harness `ops` so the workload is byte-for-byte the same array change.
 */
export const LIST_TRANSFORMS = {
  append: (b, n) => [...b, ...makeItems(1, n)],
  prepend: (b, n) => [...makeItems(1, n), ...b],
  'remove-first': (b) => b.slice(1),
  'remove-middle': (b) => {
    const m = b.length >> 1;
    return [...b.slice(0, m), ...b.slice(m + 1)];
  },
  'remove-last': (b) => b.slice(0, -1),
  reorder: (b) => {
    const c = [...b];
    const f = c[0];
    c[0] = c[c.length - 1];
    c[c.length - 1] = f;
    return c;
  },
  reverse: (b) => [...b].reverse(),
  'update-item': (b) =>
    b.map((it, i) => (i === (b.length >> 1) ? { ...it, label: it.label + '*' } : it)),
};
