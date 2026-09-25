/**
 * §2 list-reorder adapter — StreetUI.
 *
 * Uses ONLY the public `streetui` API (no internals): a `signal` of row objects driving a
 * keyed `listOf`, compiled once and mounted to a real DOM node via `createRenderer`. Each
 * operation sets a new array on the signal; StreetUI's keyed LIS reconciler computes the
 * minimal DOM moves. This is the same reconciliation path the real app's 10k-row table uses.
 *
 * Exposes `window.__bench = { mount, apply, teardown }` for scenario.mjs. It is bundled into
 * the benchmark page by run.mjs and only ever executed in a real browser.
 */
import { signal, streetui, compile, createRenderer, BrowserDOMAdapter } from 'streetui';

let rows;           // Signal<Row[]>
let handle;         // MountedApplication
const makeRow = (k) => ({ k, label: `row-${k}`, v: 0 });

function currentKeys() { return rows.peek().map((r) => r.k); }

const OPS = {
  append(n)        { const base = rows.peek(); const start = base.length; rows.set([...base, ...Array.from({ length: n }, (_, i) => makeRow(start + i))]); },
  prepend(n)       { const base = rows.peek(); rows.set([...Array.from({ length: n }, (_, i) => makeRow(-1 - i)), ...base]); },
  insertMiddle(n)  { const base = rows.peek(); const mid = base.length >> 1; const add = Array.from({ length: n }, (_, i) => makeRow(1e6 + i)); rows.set([...base.slice(0, mid), ...add, ...base.slice(mid)]); },
  removeScattered(n){ const base = rows.peek().slice(); for (let i = 0; i < n && base.length; i++) base.splice((i * 7) % base.length, 1); rows.set(base); },
  swap()           { const base = rows.peek().slice(); if (base.length > 1) { const t = base[0]; base[0] = base[base.length - 1]; base[base.length - 1] = t; } rows.set(base); },
  reverse()        { rows.set(rows.peek().slice().reverse()); },
  shuffle(seed)    { const a = rows.peek().slice(); let s = seed >>> 0; for (let i = a.length - 1; i > 0; i--) { s = (s * 1664525 + 1013904223) >>> 0; const j = s % (i + 1); const t = a[i]; a[i] = a[j]; a[j] = t; } rows.set(a); },
  update(stride)   { const a = rows.peek().map((r, i) => (i % stride === 0 ? { ...r, v: r.v + 1, label: `row-${r.k}!` } : r)); rows.set(a); },
};

globalThis.__bench = {
  async mount(container, count) {
    rows = signal(Array.from({ length: count }, (_, i) => makeRow(i)));
    const app = streetui.app({ name: 'list-reorder-bench' });
    app.page('home', (page) => {
      page.section('root', (s) => {
        s.listOf('rows', rows, (row, _i, c) => {
          c.text(row.label, { class: 'cell' });
        }, { id: 'bench-list' });
      }, { id: 'bench-root' });
    });
    const compiled = compile(app);
    const renderer = createRenderer({ domAdapter: new BrowserDOMAdapter() });
    handle = renderer.mount(compiled, container);
  },
  async apply(op) {
    const fn = OPS[op.kind];
    if (!fn) throw new Error(`unknown op kind: ${op.kind}`);
    fn(op.n ?? op.seed ?? op.stride);
  },
  teardown() { handle?.unmount?.(); rows = undefined; handle = undefined; },
};

export { currentKeys };
