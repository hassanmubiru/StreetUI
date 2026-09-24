/**
 * Memory / cleanup tests (v0.7 §15).
 *
 * These use STRUCTURAL assertions — never GC timing. They prove that repeated
 * mount/unmount cycles drain the renderer's instance index back to zero and do
 * not accumulate graph handler registrations or live signal subscriptions.
 *
 * They also guard the OPT-1 change (module-level SKIP_PROP_KEYS in mount.ts):
 * because the skip-key set is now shared across every node, these cycles would
 * surface any accidental mutation or cross-mount contamination of that set.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { resetIdCounter } from '@streetui/core';
import { streetui } from '@streetui/dsl';
import { signal, type Signal } from '@streetui/state';
import { compile } from '@streetui/compiler';
import { BrowserDOMAdapter } from '@streetui/dom';
import { createRenderContext } from './render-context.js';
import { mountGraph } from './mount.js';
import { hydrateGraph } from './hydrate.js';
import { renderToString } from './ssr.js';
import { StreetRenderHandle } from './render-handle.js';

beforeEach(() => resetIdCounter());

function makeContainer(): HTMLDivElement {
  return document.createElement('div');
}

/** Mount through the real pipeline while keeping a handle on the context so the
 *  instance index can be inspected — mirrors StreetRendererImpl.mount. */
function mountWithCtx(graph: ReturnType<typeof compile>['graph'], container: Element) {
  const ctx = createRenderContext(new BrowserDOMAdapter(), graph, container);
  const root = mountGraph(ctx);
  const handle = new StreetRenderHandle(ctx, root);
  return { ctx, handle };
}

function compileFlatApp(n: number) {
  resetIdCounter();
  const app = streetui.app({ name: 'mem' });
  app.page('home', (page) => {
    for (let i = 0; i < n; i++) page.text(`item ${i}`);
  });
  return compile(app);
}

function compileReactiveApp(sig: Signal<string>) {
  resetIdCounter();
  const app = streetui.app({ name: 'mem-reactive' });
  app.page('home', (page) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (page as any).text(sig);
  });
  return compile(app);
}

describe('memory / instance-index drains to zero across cycles', () => {
  it('flat app: instance index returns to 0 after each of 50 unmounts', () => {
    const compiled = compileFlatApp(30);
    for (let cycle = 0; cycle < 50; cycle++) {
      const container = makeContainer();
      const { ctx, handle } = mountWithCtx(compiled.graph, container);
      expect(ctx.instances.size).toBeGreaterThan(0);
      expect(container.children.length).toBeGreaterThan(0);
      handle.unmount();
      // Structural: every live NodeInstance was forgotten.
      expect(ctx.instances.size).toBe(0);
      expect(container.children.length).toBe(0);
    }
  });

  it('peak instance count is identical on every cycle (no growth)', () => {
    const compiled = compileFlatApp(30);
    const peaks: number[] = [];
    for (let cycle = 0; cycle < 20; cycle++) {
      const { ctx, handle } = mountWithCtx(compiled.graph, makeContainer());
      peaks.push(ctx.instances.size);
      handle.unmount();
    }
    // Same graph mounted repeatedly must produce the same peak every time.
    expect(new Set(peaks).size).toBe(1);
  });
});

describe('memory / reactive subscriptions do not leak', () => {
  it('post-unmount signal writes are safe no-ops and do not touch old DOM', () => {
    const sig = signal('v0');
    const compiled = compileReactiveApp(sig);

    const containers: HTMLDivElement[] = [];
    for (let cycle = 0; cycle < 25; cycle++) {
      const container = makeContainer();
      containers.push(container);
      const { handle } = mountWithCtx(compiled.graph, container);
      sig.set(`live-${cycle}`); // exercise the live subscription
      handle.unmount();
    }

    // After all cycles, every container is empty and a final write reaches none.
    sig.set('after-all');
    for (const c of containers) {
      expect(c.children.length).toBe(0);
      expect(c.textContent).toBe('');
    }
  });
});

describe('memory / graph handler registry is stable across cycles', () => {
  function compileButtonList(items: Signal<{ id: number; name: string }[]>) {
    resetIdCounter();
    const app = streetui.app({ name: 'mem-list' });
    app.page('home', (page) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (page as any).listOf(
        'items',
        items,
        (item: { id: number; name: string }, _i: number, c: { button: (l: string, o?: { onClick?: () => void }) => void }) => {
          c.button(item.name, { onClick: () => void 0 });
        },
      );
    });
    return compile(app);
  }

  const clickHandlers = (graph: { handlers: Map<string, unknown> }): number =>
    [...graph.handlers.keys()].filter((k) => k.startsWith('click:')).length;

  it('re-mounting the same list graph does not accumulate click handlers', () => {
    const items = signal([{ id: 1, name: 'a' }, { id: 2, name: 'b' }, { id: 3, name: 'c' }]);
    const compiled = compileButtonList(items);

    let stableCount = -1;
    for (let cycle = 0; cycle < 15; cycle++) {
      const { handle } = mountWithCtx(compiled.graph, makeContainer());
      const count = clickHandlers(compiled.graph);
      if (stableCount === -1) stableCount = count;
      // The live-handler count is identical on every cycle — no per-cycle growth.
      expect(count).toBe(stableCount);
      handle.unmount();
    }
    expect(stableCount).toBe(3);
  });
});

// ── OPT-1 keyed-list stress: many mutations must not leak (spec §17) ────────────
describe('memory / keyed-list mutation stress leaves no residue', () => {
  interface Row { id: number; label: string }
  const rows = (n: number, off = 0): Row[] =>
    Array.from({ length: n }, (_, i) => ({ id: i + off, label: `item-${i + off}` }));

  function compileRowList(items: Signal<Row[]>) {
    resetIdCounter();
    const app = streetui.app({ name: 'mem-rowlist' });
    app.page('home', (page) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (page as any).listOf('rows', items, (item: Row, _i: number, c: any) =>
        c.text(item.label),
      );
    });
    return compile(app);
  }

  // Count graph handler entries owned by reactive-list plumbing that MUST be
  // pruned when their item/list nodes are detached.
  const listHandlerKeys = (graph: { handlers: Map<string, unknown> }): number =>
    [...graph.handlers.keys()].filter(
      (k) => k.startsWith('__signal__') || k.startsWith('__listbuild__') || k.startsWith('__listplan__'),
    ).length;

  it('grow → churn → return to start drains instances and handlers to baseline', () => {
    const base = rows(100);
    const items = signal(base);
    const compiled = compileRowList(items);
    const { ctx, handle } = mountWithCtx(compiled.graph, makeContainer());

    const baselineInstances = ctx.instances.size;
    const baselineHandlers = listHandlerKeys(compiled.graph);
    expect(baselineInstances).toBeGreaterThan(200); // 100 <li> + 100 <span> + structure

    // 300 mixed mutations: append, prepend, remove, reorder, reverse, update.
    let cur = base;
    for (let i = 0; i < 300; i++) {
      const mode = i % 6;
      if (mode === 0) cur = [...cur, ...rows(1, 1000 + i)];
      else if (mode === 1) cur = [...rows(1, 2000 + i), ...cur];
      else if (mode === 2) cur = cur.slice(1);
      else if (mode === 3 && cur.length > 1) {
        const c = [...cur]; const f = c[0]!; c[0] = c[c.length - 1]!; c[c.length - 1] = f; cur = c;
      } else if (mode === 4) cur = [...cur].reverse();
      else cur = cur.map((r, idx) => (idx === 0 ? { ...r, label: r.label + '*' } : r));
      items.set(cur);
    }

    // Return to the EXACT original item references.
    items.set(base);

    // No residue: instance index and list-handler registry are back to baseline.
    expect(ctx.instances.size).toBe(baselineInstances);
    expect(listHandlerKeys(compiled.graph)).toBe(baselineHandlers);

    handle.unmount();
    // Full unmount drains the instance index to just-the-root-or-empty.
    expect(ctx.instances.size).toBeLessThanOrEqual(1);
  });
});
