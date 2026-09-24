/**
 * Regression suite for the optimised keyed-list reconciler (spec §15, §26).
 *
 * These tests pin the *structural* guarantees of the lazy-plan + LIS reconciler,
 * not wall-clock time (which is environment-dependent and would be flaky in CI):
 *
 *   - a keyed list only *creates* DOM for genuinely new rows (lazy build),
 *   - a reorder / prepend performs the *minimal* number of DOM moves,
 *   - a row whose source object reference is unchanged is never rebuilt,
 *   - a row whose data changed gets a *targeted* in-place update while keeping
 *     its element identity.
 *
 * Counts are captured with a DOMAdapter decorator — the same choke-point every
 * renderer write flows through — so the assertions measure real DOM traffic.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { resetIdCounter } from '@streetui/core';
import { streetui } from '@streetui/dsl';
import { signal, type Signal } from '@streetui/state';
import { compile } from '@streetui/compiler';
import { BrowserDOMAdapter, type DOMAdapter } from '@streetui/dom';
import { createRenderer } from './renderer.js';

beforeEach(() => resetIdCounter());

interface Counts {
  createElement: number;
  createTextNode: number;
  appendChild: number;
  insertBefore: number;
  removeChild: number;
  setTextContent: number;
  setAttribute: number;
}

function makeCountingAdapter(): { adapter: DOMAdapter; c: Counts; reset: () => void } {
  const base = new BrowserDOMAdapter();
  const c: Counts = {
    createElement: 0, createTextNode: 0, appendChild: 0, insertBefore: 0,
    removeChild: 0, setTextContent: 0, setAttribute: 0,
  };
  const adapter = {
    createElement(t: string) { c.createElement++; return base.createElement(t); },
    createTextNode(d: string) { c.createTextNode++; return base.createTextNode(d); },
    appendChild(p: Node, ch: Node) { c.appendChild++; return base.appendChild(p, ch); },
    insertBefore(p: Node, ch: Node, r: Node | null) { c.insertBefore++; return base.insertBefore(p, ch, r); },
    removeChild(p: Node, ch: Node) { c.removeChild++; return base.removeChild(p, ch); },
    setTextContent(n: Node, t: string) { c.setTextContent++; return base.setTextContent(n, t); },
    setAttribute(e: Element, n: string, v: string) { c.setAttribute++; return base.setAttribute(e, n, v); },
  } as Record<string, unknown>;
  // Pass through any adapter method we did not explicitly wrap.
  for (const k of Object.getOwnPropertyNames(Object.getPrototypeOf(base))) {
    if (k !== 'constructor' && typeof (base as never)[k] === 'function' && !(k in adapter)) {
      adapter[k] = (...a: unknown[]) => (base as never)[k](...(a as never));
    }
  }
  return {
    adapter: adapter as unknown as DOMAdapter,
    c,
    reset() { for (const k of Object.keys(c)) (c as never)[k] = 0 as never; },
  };
}

interface Row { id: number; label: string }
const rows = (n: number, off = 0): Row[] =>
  Array.from({ length: n }, (_, i) => ({ id: i + off, label: `item-${i + off}` }));

function mountRows(items: Signal<Row[]>) {
  const { adapter, c, reset } = makeCountingAdapter();
  const app = streetui.app({ name: 'perf' });
  app.page('home', (p) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (p as any).listOf('rows', items, (item: Row, _i: number, content: any) =>
      content.text(item.label, { class: 'cell' }),
    );
  });
  const container = document.createElement('div');
  createRenderer({ domAdapter: adapter }).mount(compile(app), container);
  return { container, c, reset };
}

const labels = (container: Element) =>
  Array.from(container.querySelectorAll('li')).map((li) => li.textContent);

describe('keyed-list reconciler — lazy build (spec §15)', () => {
  it('append creates DOM for ONLY the new row, not the whole list', () => {
    const base = rows(500);
    const items = signal(base);
    const { container, c, reset } = mountRows(items);
    expect(container.querySelectorAll('li').length).toBe(500);

    reset();
    items.set([...base, ...rows(1, 500)]); // append one; existing refs reused
    // Old eager path rebuilt all 501 <li> + text nodes here. Lazy path builds 1.
    expect(container.querySelectorAll('li').length).toBe(501);
    expect(c.createElement).toBeLessThanOrEqual(2); // 1 <li> (+ its text is a text node)
    expect(c.createElement).toBeGreaterThanOrEqual(1);
    expect(c.removeChild).toBe(0);
  });

  it('remove creates nothing and removes exactly one row', () => {
    const base = rows(300);
    const items = signal(base);
    const { container, c, reset } = mountRows(items);

    reset();
    items.set(base.slice(1)); // drop first; all survivors keep their references
    expect(container.querySelectorAll('li').length).toBe(299);
    expect(c.createElement).toBe(0);
    expect(c.removeChild).toBe(1);
    expect(c.insertBefore).toBe(0); // survivors already in order → no moves
  });

  it('reusing identical item references rebuilds nothing', () => {
    const base = rows(200);
    const items = signal(base);
    const { container, c, reset } = mountRows(items);

    reset();
    items.set([...base]); // new array, SAME element references
    expect(c.createElement).toBe(0);
    expect(c.createTextNode).toBe(0);
    expect(c.setTextContent).toBe(0);
    expect(c.removeChild).toBe(0);
    expect(labels(container).slice(0, 3)).toEqual(['item-0', 'item-1', 'item-2']);
  });
});

describe('keyed-list reconciler — minimal moves (spec §15)', () => {
  it('prepend moves ONE node, not the whole list', () => {
    const base = rows(500);
    const items = signal(base);
    const { c, reset } = mountRows(items);

    reset();
    items.set([...rows(1, 999), ...base]); // prepend a brand-new row
    // The new row is created (appended at end by mount) then moved to the front:
    // a single insertBefore. The 500 survivors are NOT moved.
    expect(c.insertBefore).toBeLessThanOrEqual(2);
  });

  it('swap-ends reorder moves at most two nodes', () => {
    const base = rows(400);
    const items = signal(base);
    const { container, c, reset } = mountRows(items);

    reset();
    const swapped = [...base];
    const first = swapped[0]!;
    swapped[0] = swapped[swapped.length - 1]!;
    swapped[swapped.length - 1] = first;
    items.set(swapped);

    expect(c.createElement).toBe(0);
    expect(c.insertBefore).toBeLessThanOrEqual(2); // LIS keeps the 398 middle rows put
    expect(labels(container)[0]).toBe('item-399');
    expect(labels(container)[399]).toBe('item-0');
  });

  it('reverse is correct and reuses every element (identity preserved)', () => {
    const base = rows(50);
    const items = signal(base);
    const { container, c, reset } = mountRows(items);
    const firstEl = container.querySelector('li[data-streetui-key="id:0"]')!;

    reset();
    items.set([...base].reverse());
    expect(c.createElement).toBe(0); // no rebuilds — pure reorder
    expect(labels(container)).toEqual(rows(50).reverse().map((r) => r.label));
    // The element for id:0 is the very same node, now last.
    const firstElAfter = container.querySelector('li[data-streetui-key="id:0"]')!;
    expect(firstElAfter).toBe(firstEl);
  });
});

describe('keyed-list reconciler — targeted data update (spec §13/§15)', () => {
  it('changing one item updates only that row in place', () => {
    const base = rows(100);
    const items = signal(base);
    const { container, c, reset } = mountRows(items);
    const targetEl = container.querySelector('li[data-streetui-key="id:42"]')!;

    reset();
    // Replace ONE item with a new object of the same identity but changed data.
    const next = base.map((r) => (r.id === 42 ? { ...r, label: 'CHANGED' } : r));
    items.set(next);

    // Element identity for the changed row is preserved (no remount of the <li>).
    const targetAfter = container.querySelector('li[data-streetui-key="id:42"]')!;
    expect(targetAfter).toBe(targetEl);
    expect(targetAfter.textContent).toBe('CHANGED');
    // No new <li> elements, and no rows removed — this is an in-place content
    // patch, not a structural change.
    expect(c.removeChild).toBe(0);
    // Exactly one row's text was rewritten.
    expect(c.setTextContent).toBe(1);
  });
});
